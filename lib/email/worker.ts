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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let campaign: any = null;

    try {
      // 2. Fetch dependencies: recipient, campaign, and lead
      const { data: recipient, error: recError } = await supabase
        .from("campaign_recipients")
        .select(`
          *,
          campaigns (id, status, email_account_id, sender_name, follow_up_1_template_id, follow_up_1_delay_days, follow_up_2_template_id, follow_up_2_delay_days),
          leads (id, email, first_name, last_name, full_name, company_name, job_title, website_url, status)
        `)
        .eq("id", job.campaign_recipient_id)
        .single();

      if (recError || !recipient) {
        throw new Error("Recipient record not found");
      }

      campaign = recipient.campaigns;
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

      // Pre-Send Guard 6: Snapshot Verification & Follow-up Rendering
      let subjectToSend = "";
      let bodyToSend = "";
      
      const jobType = job.job_type || "initial";
      
      if (jobType === "initial") {
        const snapshot = recipient.approved_snapshot;
        if (!snapshot || !snapshot.subject || !snapshot.body) {
          finalJobStatus = "failed";
          throw new Error("Missing approved email snapshot (subject/body)");
        }
        subjectToSend = snapshot.subject;
        bodyToSend = snapshot.body;
      } else {
        // Follow-up rendering on the fly
        let templateId = null;
        if (jobType === "follow_up_1") templateId = campaign.follow_up_1_template_id;
        else if (jobType === "follow_up_2") templateId = campaign.follow_up_2_template_id;
        
        if (!templateId) {
          finalJobStatus = "cancelled";
          throw new Error(`No template configured for ${jobType}`);
        }
        
        const { data: template } = await supabase.from("email_templates").select("*").eq("id", templateId).single();
        if (!template) {
          finalJobStatus = "failed";
          throw new Error("Follow-up template not found");
        }
        
        const { renderTemplate } = await import("@/lib/template-renderer");
        const variables = {
          first_name: lead.first_name,
          last_name: lead.last_name,
          full_name: lead.full_name,
          company_name: lead.company_name,
          job_title: lead.job_title,
          website: lead.website_url,
          booking_link: campaign.booking_url,
          sender_name: campaign.sender_name,
          sender_email: "",
        };
        subjectToSend = renderTemplate(template.subject, variables);
        bodyToSend = renderTemplate(template.body, variables);
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
      const sendOptions: SendEmailOptions = {
        to: lead.email,
        subject: subjectToSend,
        body: bodyToSend,
      };
      
      if (jobType !== "initial" && recipient.provider_thread_id) {
        sendOptions.threadId = recipient.provider_thread_id;
      }

      const sendResult = await provider.sendEmail(sendOptions);

      if (sendResult.success) {
        success = true;
        finalJobStatus = "sent";
        providerMessageId = sendResult.messageId || `msg_${crypto.randomUUID()}`;
        
        // Store thread ID if this is the initial email
        if (jobType === "initial" && sendResult.threadId) {
          await supabase.from("campaign_recipients").update({ provider_thread_id: sendResult.threadId }).eq("id", recipient.id);
        }
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
        errorMessage.includes("suppression list") ||
        errorMessage.includes("No template configured");

      const isPermanent =
        errorMessage.toLowerCase().includes("invalid_grant") ||
        errorMessage.toLowerCase().includes("authentication expired") ||
        errorMessage.toLowerCase().includes("missing approved email snapshot") ||
        errorMessage.toLowerCase().includes("missing or invalid") ||
        errorMessage.toLowerCase().includes("template not found");

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
      const recipientStatus = "sent";
      const stepUpdate = job.job_type === "initial" ? 0 : (job.job_type === "follow_up_1" ? 1 : 2);
      
      const updatePayload: Record<string, string | number> = {
        status: recipientStatus,
        follow_up_step: stepUpdate,
      };
      
      if (job.job_type === "initial") {
        updatePayload.sent_at = new Date().toISOString();
        updatePayload.delivered_at = new Date().toISOString();
      } else {
        updatePayload.follow_up_sent_at = new Date().toISOString();
      }

      await supabase
        .from("campaign_recipients")
        .update(updatePayload)
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
        event_data: { lead_id: leadId, sent_at: new Date().toISOString(), job_type: job.job_type },
      });
      
      // Schedule Next Follow Up if configured
      if (job.job_type === "initial" && campaign?.follow_up_1_delay_days) {
         await supabase.from("email_jobs").insert({
           workspace_id: job.workspace_id,
           campaign_recipient_id: job.campaign_recipient_id,
           status: "queued",
           job_type: "follow_up_1",
           scheduled_at: new Date(Date.now() + campaign.follow_up_1_delay_days * 24 * 60 * 60 * 1000).toISOString(),
           idempotency_key: `job-campaign-${campaign.id}-recipient-${job.campaign_recipient_id}-f1`,
         });
      } else if (job.job_type === "follow_up_1" && campaign?.follow_up_2_delay_days) {
         await supabase.from("email_jobs").insert({
           workspace_id: job.workspace_id,
           campaign_recipient_id: job.campaign_recipient_id,
           status: "queued",
           job_type: "follow_up_2",
           scheduled_at: new Date(Date.now() + campaign.follow_up_2_delay_days * 24 * 60 * 60 * 1000).toISOString(),
           idempotency_key: `job-campaign-${campaign.id}-recipient-${job.campaign_recipient_id}-f2`,
         });
      }

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
