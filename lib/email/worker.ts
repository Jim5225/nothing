import { createClient } from "@supabase/supabase-js";
import { GmailProvider } from "./gmail-provider";

const MAX_RETRIES = 3;
const BATCH_SIZE = 20;

export async function processEmailQueue() {
  // Use Service Role Key for background processing to bypass RLS and perform atomic claims securely
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // 1. Claim Jobs Atomically
  const { data: claimedJobs, error: claimError } = await supabase.rpc("claim_email_jobs", {
    batch_size: BATCH_SIZE
  });

  if (claimError) {
    console.error("Failed to claim email jobs:", claimError);
    return { error: claimError.message };
  }

  if (!claimedJobs || claimedJobs.length === 0) {
    return { processed: 0 };
  }

  const results = [];
  const processedCampaignIds = new Set<string>();

  for (const job of claimedJobs) {
    let success = false;
    let finalJobStatus = "failed";
    let nextSchedule = null;
    let errorMessage = null;
    let providerMessageId = null;
    let pauseCampaign = false;

    let leadId = null;
    let leadStatus = null;

    try {
      // Fetch full recipient + campaign + lead details
      const { data: recipient, error: recError } = await supabase
        .from("campaign_recipients")
        .select("*, campaigns(*), leads(*)")
        .eq("id", job.campaign_recipient_id)
        .single();

      if (recError || !recipient) throw new Error("Recipient not found");
      const campaign = recipient.campaigns;
      const lead = recipient.leads;
      if (lead) {
        leadId = lead.id;
        leadStatus = lead.status;
      }

      processedCampaignIds.add(campaign.id);

      // Pre-Send Checks
      if (campaign.status !== "approved" && campaign.status !== "sending") {
        throw new Error("Campaign is not active (paused/cancelled/completed)");
      }

      if (recipient.status !== "queued" && recipient.status !== "sending") {
        throw new Error(`Recipient status is invalid (${recipient.status})`);
      }

      if (!lead?.email) {
        throw new Error("Lead has no email address");
      }

      // Check if lead is suppressed globally right before sending
      const { data: isSuppressed } = await supabase
        .from("lead_suppression")
        .select("id")
        .eq("email", lead.email)
        .single();
      
      if (isSuppressed) {
        // Mark recipient as stopped
        await supabase
          .from("campaign_recipients")
          .update({ status: "stopped", stop_reason: "Suppressed lead detected before send" })
          .eq("id", recipient.id);
        throw new Error("Lead is suppressed");
      }

      const snapshot = recipient.approved_snapshot;
      if (!snapshot || !snapshot.subject || !snapshot.body) {
        throw new Error("Missing approved snapshot");
      }

      // Transition campaign to sending if it was approved
      if (campaign.status === "approved") {
        await supabase
          .from("campaigns")
          .update({ status: "sending", started_at: new Date().toISOString() })
          .eq("id", campaign.id)
          .eq("status", "approved"); // optimistic lock
      }

      // Instantiate Provider
      const provider = new GmailProvider(campaign.email_account_id);
      
      // Attempt Send
      const sendResult = await provider.sendEmail({
        to: lead.email,
        subject: snapshot.subject,
        body: snapshot.body,
      });

      if (sendResult.success) {
        success = true;
        finalJobStatus = "sent";
        providerMessageId = sendResult.messageId;
      } else {
        throw new Error(sendResult.error || "Unknown provider error");
      }

    } catch (err: unknown) {
      success = false;
      errorMessage = err instanceof Error ? err.message : "Unknown error";
      
      // Determine retry logic
      const isAuthError = errorMessage.toLowerCase().includes("invalid_grant") || errorMessage.toLowerCase().includes("authentication expired");
      const isCancellation = errorMessage.includes("Campaign is not active") || errorMessage.includes("Recipient status is invalid") || errorMessage.includes("Lead is suppressed");

      if (isCancellation) {
        finalJobStatus = "cancelled";
      } else if (isAuthError) {
        finalJobStatus = "failed";
        pauseCampaign = true; 
      } else {
        // Temporary / general error -> Retry logic
        if (job.attempt_count < MAX_RETRIES) {
          finalJobStatus = "queued";
          const delayMinutes = Math.pow(2, job.attempt_count) * 5; // 5, 10, 20 mins
          nextSchedule = new Date(Date.now() + delayMinutes * 60000).toISOString();
        } else {
          finalJobStatus = "failed";
        }
      }
    }

    // Write Results back to DB
    await supabase
      .from("email_jobs")
      .update({
        status: finalJobStatus,
        last_error: errorMessage,
        provider_message_id: providerMessageId,
        scheduled_at: nextSchedule || job.scheduled_at,
        completed_at: finalJobStatus !== "queued" ? new Date().toISOString() : null
      })
      .eq("id", job.id);

    // Update Recipient Status if final
    if (finalJobStatus === "sent") {
      await supabase
        .from("campaign_recipients")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", job.campaign_recipient_id);
        
      // Update lead status to 'contacted' if it's currently 'new'
      if (leadId && (!leadStatus || leadStatus === "new")) {
        await supabase
          .from("leads")
          .update({ status: "contacted" })
          .eq("id", leadId);
          
        await supabase.from("activity_logs").insert({
          workspace_id: job.workspace_id,
          action: "lead_status_changed",
          details: { lead_id: leadId, new_status: "contacted" }
        });
      }
      
      await supabase.from("activity_logs").insert({
        workspace_id: job.workspace_id,
        action: "email_sent",
        details: { campaign_recipient_id: job.campaign_recipient_id, lead_id: leadId }
      });
      
    } else if (finalJobStatus === "failed") {
      await supabase
        .from("campaign_recipients")
        .update({ status: "failed" })
        .eq("id", job.campaign_recipient_id);
        
      await supabase.from("activity_logs").insert({
        workspace_id: job.workspace_id,
        action: "email_failed",
        details: { campaign_recipient_id: job.campaign_recipient_id, error: errorMessage }
      });
    }

    // Handle Auth failure pausing
    if (pauseCampaign) {
      // Find campaign id from the job record
      const { data: rec } = await supabase.from("campaign_recipients").select("campaign_id").eq("id", job.campaign_recipient_id).single();
      if (rec) {
        await supabase
          .from("campaigns")
          .update({ status: "paused" })
          .eq("id", rec.campaign_id)
          .neq("status", "paused"); // Only update if not already paused
      }
    }

    results.push({ jobId: job.id, success, status: finalJobStatus, error: errorMessage });
  }

  // Check completion for all processed campaigns
  for (const cid of processedCampaignIds) {
    const { count: remainingJobs } = await supabase
      .from("email_jobs")
      .select("*", { count: "exact", head: true })
      .in("status", ["queued", "processing"])
      .eq("workspace_id", claimedJobs[0].workspace_id) // Assumes single workspace isolation
      .in("campaign_recipient_id", (
        await supabase.from("campaign_recipients").select("id").eq("campaign_id", cid)
      ).data?.map(r => r.id) || []);
      
    if (remainingJobs === 0) {
      // Campaign completed
      await supabase
        .from("campaigns")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", cid)
        .in("status", ["sending", "approved"]); 
    }
  }

  return { processed: results.length, results };
}
