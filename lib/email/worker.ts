import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { GmailProvider } from "./gmail-provider";

const MAX_RETRIES = 3;
const BATCH_SIZE = 20;

export async function processEmailQueue(customSupabaseClient?: SupabaseClient) {
  // Use Service Role Key for background processing to bypass RLS and perform atomic claims securely
  const supabase =
    customSupabaseClient ||
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

  // 1. Claim Jobs Atomically using Postgres FOR UPDATE SKIP LOCKED
  const { data: claimedJobs, error: claimError } = await supabase.rpc("claim_email_jobs", {
    batch_size: BATCH_SIZE,
  });

  if (claimError) {
    console.error("[EmailWorker] Failed to claim email jobs:", claimError);
    return { error: claimError.message };
  }

  if (!claimedJobs || claimedJobs.length === 0) {
    return { processed: 0, results: [] };
  }

  const results = [];
  const processedCampaignIds = new Set<string>();

  for (const job of claimedJobs) {
    let success = false;
    let finalJobStatus: "sent" | "failed" | "queued" | "cancelled" = "failed";
    let nextSchedule: string | null = null;
    let errorMessage: string | null = null;
    let providerMessageId: string | null = null;
    let pauseCampaign = false;
    let leadId: string | null = null;
    let leadStatus: string | null = null;

    try {
      // 2. Fetch full recipient + campaign + lead details
      const { data: recipient, error: recError } = await supabase
        .from("campaign_recipients")
        .select("*, campaigns(*), leads(*)")
        .eq("id", job.campaign_recipient_id)
        .single();

      if (recError || !recipient) {
        throw new Error("Recipient record not found");
      }

      const campaign = recipient.campaigns;
      const lead = recipient.leads;

      if (lead) {
        leadId = lead.id;
        leadStatus = lead.status;
      }

      if (campaign?.id) {
        processedCampaignIds.add(campaign.id);
      }

      // Pre-Send Guard 1: Campaign Status Check
      if (!campaign || (campaign.status !== "approved" && campaign.status !== "sending")) {
        finalJobStatus = "cancelled";
        throw new Error(`Campaign is not active (status: ${campaign?.status || "unknown"})`);
      }

      // Pre-Send Guard 2: Recipient Status & Idempotency Check
      if (recipient.status === "sent") {
        // Already sent! Prevent duplicate send
        success = true;
        finalJobStatus = "sent";
        results.push({ jobId: job.id, success: true, status: "sent", note: "Already sent" });
        continue;
      }

      if (recipient.status === "stopped" || recipient.status === "unsubscribed" || recipient.status === "bounced") {
        finalJobStatus = "cancelled";
        throw new Error(`Recipient is in terminal non-sendable status (${recipient.status})`);
      }

      // Pre-Send Guard 3: Recipient Replied Check
      if (recipient.status === "replied" || recipient.replied_at) {
        finalJobStatus = "cancelled";
        throw new Error("Lead has already replied to this campaign");
      }

      // Pre-Send Guard 4: Missing Email Check
      if (!lead?.email || !lead.email.includes("@")) {
        finalJobStatus = "failed";
        throw new Error("Lead email address is missing or invalid");
      }

      // Pre-Send Guard 5: Real-Time Suppression Check
      const { data: suppressionRecord } = await supabase
        .from("lead_suppression")
        .select("id, reason")
        .eq("workspace_id", job.workspace_id)
        .eq("email", lead.email.toLowerCase().trim())
        .maybeSingle();

      if (suppressionRecord) {
        await supabase
          .from("campaign_recipients")
          .update({
            status: "stopped",
            stop_reason: `Suppression list match: ${suppressionRecord.reason || "Do not contact"}`,
            stopped_at: new Date().toISOString(),
          })
          .eq("id", recipient.id);

        finalJobStatus = "cancelled";
        throw new Error(`Lead ${lead.email} is on the suppression list`);
      }

      // Pre-Send Guard 6: Snapshot Verification
      const snapshot = recipient.approved_snapshot;
      if (!snapshot || !snapshot.subject || !snapshot.body) {
        finalJobStatus = "failed";
        throw new Error("Missing approved email snapshot (subject/body)");
      }

      // Transition campaign status to 'sending' if it was approved
      if (campaign.status === "approved") {
        await supabase
          .from("campaigns")
          .update({ status: "sending", started_at: new Date().toISOString() })
          .eq("id", campaign.id)
          .eq("status", "approved");
      }

      // 3. Instantiate decoupled GmailProvider with service client
      const provider = new GmailProvider(campaign.email_account_id, supabase);

      // 4. Dispatch Email
      const sendResult = await provider.sendEmail({
        to: lead.email,
        subject: snapshot.subject,
        body: snapshot.body,
      });

      if (sendResult.success) {
        success = true;
        finalJobStatus = "sent";
        providerMessageId = sendResult.messageId || `msg_${crypto.randomUUID()}`;
      } else {
        if (sendResult.isPermanentError) {
          pauseCampaign = true;
          finalJobStatus = "failed";
          throw new Error(sendResult.error || "Permanent provider authentication error");
        }

        throw new Error(sendResult.error || "Provider delivery failed");
      }
    } catch (err: unknown) {
      success = false;
      errorMessage = err instanceof Error ? err.message : "Unknown send error";

      const isCancellation =
        errorMessage.includes("Campaign is not active") ||
        errorMessage.includes("Recipient is in terminal") ||
        errorMessage.includes("already replied") ||
        errorMessage.includes("suppression list");

      const isPermanent =
        errorMessage.toLowerCase().includes("invalid_grant") ||
        errorMessage.toLowerCase().includes("authentication expired") ||
        errorMessage.toLowerCase().includes("missing approved email snapshot") ||
        errorMessage.toLowerCase().includes("missing or invalid");

      if (isCancellation) {
        finalJobStatus = "cancelled";
      } else if (isPermanent) {
        finalJobStatus = "failed";
        if (errorMessage.toLowerCase().includes("invalid_grant") || errorMessage.toLowerCase().includes("authentication expired")) {
          pauseCampaign = true;
        }
      } else {
        // Transient error -> Exponential backoff with jitter
        if (job.attempt_count < MAX_RETRIES) {
          finalJobStatus = "queued";
          const delayMinutes = Math.min(Math.pow(2, job.attempt_count) * 2 + Math.random() * 2, 60);
          nextSchedule = new Date(Date.now() + delayMinutes * 60000).toISOString();
        } else {
          finalJobStatus = "failed";
        }
      }
    }

    // 5. Update Email Job Record in Postgres
    await supabase
      .from("email_jobs")
      .update({
        status: finalJobStatus,
        last_error: errorMessage,
        provider_message_id: providerMessageId,
        scheduled_at: nextSchedule || job.scheduled_at,
        completed_at: finalJobStatus !== "queued" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    // 6. Update Recipient Record and Lead Status
    if (finalJobStatus === "sent") {
      await supabase
        .from("campaign_recipients")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          delivered_at: new Date().toISOString(),
        })
        .eq("id", job.campaign_recipient_id);

      if (leadId && (!leadStatus || leadStatus === "new")) {
        await supabase.from("leads").update({ status: "contacted" }).eq("id", leadId);
      }

      // Log email sent event
      await supabase.from("email_events").insert({
        workspace_id: job.workspace_id,
        campaign_recipient_id: job.campaign_recipient_id,
        provider: "gmail",
        provider_event_id: providerMessageId,
        event_type: "sent",
        event_data: { lead_id: leadId, sent_at: new Date().toISOString() },
      });
    } else if (finalJobStatus === "failed") {
      await supabase
        .from("campaign_recipients")
        .update({
          status: "failed",
        })
        .eq("id", job.campaign_recipient_id);
    }

    // 7. Auto-Pause Campaign if critical auth failure
    if (pauseCampaign) {
      const { data: rec } = await supabase
        .from("campaign_recipients")
        .select("campaign_id")
        .eq("id", job.campaign_recipient_id)
        .single();

      if (rec?.campaign_id) {
        await supabase
          .from("campaigns")
          .update({ status: "paused" })
          .eq("id", rec.campaign_id)
          .neq("status", "paused");
      }
    }

    results.push({
      jobId: job.id,
      success,
      status: finalJobStatus,
      error: errorMessage,
    });
  }

  // 8. Auto-Complete check for processed campaigns
  for (const cid of processedCampaignIds) {
    const { data: recs } = await supabase
      .from("campaign_recipients")
      .select("id")
      .eq("campaign_id", cid);

    const recIds = (recs || []).map((r) => r.id);

    if (recIds.length > 0) {
      const { count: remainingActiveJobs } = await supabase
        .from("email_jobs")
        .select("*", { count: "exact", head: true })
        .in("status", ["queued", "processing"])
        .in("campaign_recipient_id", recIds);

      if (remainingActiveJobs === 0) {
        await supabase
          .from("campaigns")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", cid)
          .in("status", ["sending", "approved"]);
      }
    }
  }

  return { processed: results.length, results };
}
