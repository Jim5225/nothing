"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { renderTemplate } from "@/lib/template-renderer";
import { revalidatePath } from "next/cache";
import { GmailProvider } from "@/lib/email/gmail-provider";

export async function generateSnapshots(campaignId: string) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();

  // Fetch campaign and template
  const { data: campaign, error: campError } = await supabase
    .from("campaigns")
    .select("*, email_templates(*)")
    .eq("id", campaignId)
    .eq("workspace_id", workspace.workspace_id)
    .single();

  if (campError || !campaign) throw new Error("Campaign not found");
  if (!campaign.email_templates) throw new Error("Template not found");
  if (campaign.status !== "draft" && campaign.status !== "ready") {
    throw new Error("Cannot modify snapshots after approval.");
  }

  // Fetch pending recipients with leads
  const { data: recipients, error: recError } = await supabase
    .from("campaign_recipients")
    .select("id, leads(*)")
    .eq("campaign_id", campaignId)
    .eq("workspace_id", workspace.workspace_id);

  if (recError) throw recError;

  // Process all
  for (const rec of recipients) {
    // Suppress TS errors assuming leads might be an array
    const lead = Array.isArray(rec.leads) ? rec.leads[0] : rec.leads;
    if (!lead) continue;

    const variables = {
      first_name: lead.first_name,
      last_name: lead.last_name,
      full_name: lead.full_name,
      company_name: lead.company_name,
      job_title: lead.job_title,
      website: lead.website_url,
      booking_link: campaign.booking_url,
      sender_name: campaign.sender_name,
      sender_email: "", // Test/Preview mode
    };

    const renderedSubject = renderTemplate(campaign.email_templates.subject, variables);
    const renderedBody = renderTemplate(campaign.email_templates.body, variables);

    await supabase
      .from("campaign_recipients")
      .update({
        rendered_subject: renderedSubject,
        rendered_body: renderedBody,
      })
      .eq("id", rec.id);
  }

  revalidatePath(`/dashboard/campaigns/${campaignId}/review`);
}

export async function removeRecipient(recipientId: string, campaignId: string) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("status")
    .eq("id", campaignId)
    .single();

  if (campaign && campaign.status !== "draft" && campaign.status !== "ready") {
    throw new Error("Cannot remove recipients after approval.");
  }

  const { error } = await supabase
    .from("campaign_recipients")
    .delete()
    .eq("id", recipientId)
    .eq("workspace_id", workspace.workspace_id);

  if (error) throw error;
  revalidatePath(`/dashboard/campaigns/${campaignId}/review`);
}

export async function updateCampaignSender(campaignId: string, emailAccountId: string) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();

  const { error } = await supabase
    .from("campaigns")
    .update({ email_account_id: emailAccountId })
    .eq("id", campaignId)
    .eq("workspace_id", workspace.workspace_id);

  if (error) throw error;
  revalidatePath(`/dashboard/campaigns/${campaignId}/review`);
}

export async function sendTestEmail(campaignId: string, testEmailAddress: string) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();

  // Fetch campaign
  const { data: campaign, error: campError } = await supabase
    .from("campaigns")
    .select("email_account_id, email_templates(*)")
    .eq("id", campaignId)
    .eq("workspace_id", workspace.workspace_id)
    .single();

  if (campError || !campaign) throw new Error("Campaign not found");
  if (!campaign.email_account_id) throw new Error("No connected Gmail account selected.");

  // For test email, render generic variables
  const variables = {
    first_name: "Test",
    last_name: "User",
    full_name: "Test User",
    company_name: "Test Company",
    job_title: "Tester",
    website: "https://example.com",
    booking_link: "https://booking.com",
    sender_name: "Test Sender",
    sender_email: "", 
  };

  const template = Array.isArray(campaign.email_templates) ? campaign.email_templates[0] : campaign.email_templates;

  const subject = "[TEST] " + renderTemplate(template.subject, variables);
  const body = renderTemplate(template.body, variables);

  const provider = new GmailProvider(campaign.email_account_id);
  const res = await provider.sendEmail({
    to: testEmailAddress,
    subject,
    body,
  });

  if (!res.success) {
    throw new Error(res.error || "Failed to send test email");
  }

  return { success: true };
}

export async function approveCampaign(campaignId: string) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();

  // 1. Fetch Campaign and Account
  const { data: campaign, error: campError } = await supabase
    .from("campaigns")
    .select("*, email_accounts(status)")
    .eq("id", campaignId)
    .eq("workspace_id", workspace.workspace_id)
    .single();

  if (campError || !campaign) throw new Error("Campaign not found");
  if (campaign.status === "approved" || campaign.status === "sending") {
    throw new Error("Campaign is already approved or sending");
  }
  if (!campaign.email_account_id || !campaign.email_accounts || campaign.email_accounts.status !== "connected") {
    throw new Error("A connected Gmail account is required for approval");
  }

  // 2. Check recipients
  const { data: recipients, error: recError } = await supabase
    .from("campaign_recipients")
    .select("id, lead_id, rendered_subject, rendered_body, leads(email)")
    .eq("campaign_id", campaignId)
    .eq("workspace_id", workspace.workspace_id);

  if (recError) throw recError;
  if (!recipients || recipients.length === 0) {
    throw new Error("Cannot approve campaign with no recipients");
  }

  // 3. Verify rendered emails exist and validate against suppressed leads
  const { data: suppressed } = await supabase
    .from("lead_suppression")
    .select("email")
    .eq("workspace_id", workspace.workspace_id);
    
  const suppressedEmails = new Set(suppressed?.map(s => s.email.toLowerCase()) || []);

  const validRecipientsToUpdate = [];
  const invalidRecipientsToStop = [];

  for (const rec of recipients) {
    const lead = Array.isArray(rec.leads) ? rec.leads[0] : rec.leads;

    if (!rec.rendered_subject || !rec.rendered_body) {
      throw new Error(`Recipient ${lead?.email} is missing rendered templates. Please regenerate previews.`);
    }

    if (suppressedEmails.has(lead?.email?.toLowerCase())) {
      invalidRecipientsToStop.push(rec.id);
    } else {
      validRecipientsToUpdate.push(rec);
    }
  }

  if (validRecipientsToUpdate.length === 0) {
    throw new Error("All recipients are suppressed. Cannot approve empty campaign.");
  }

  // 4. Update suppressed recipients
  if (invalidRecipientsToStop.length > 0) {
    await supabase
      .from("campaign_recipients")
      .update({
        status: "stopped",
        stop_reason: "Suppressed lead",
        stopped_at: new Date().toISOString()
      })
      .in("id", invalidRecipientsToStop);
  }

  // 5. Freeze snapshots and queue jobs for valid recipients
  const jobsToQueue = [];
  const idempotencyPrefix = crypto.randomUUID();
  
  for (const rec of validRecipientsToUpdate) {
    // 5a. Freeze snapshot and change recipient status to queued
    await supabase
      .from("campaign_recipients")
      .update({
        status: "queued",
        approved_snapshot: {
          subject: rec.rendered_subject,
          body: rec.rendered_body
        }
      })
      .eq("id", rec.id);

    // 5b. Prepare email job
    jobsToQueue.push({
      workspace_id: workspace.workspace_id,
      campaign_recipient_id: rec.id,
      status: "queued",
      attempt_count: 0,
      scheduled_at: new Date().toISOString(), // schedule immediately
      idempotency_key: `${idempotencyPrefix}-${rec.id}`
    });
  }

  // Insert jobs
  if (jobsToQueue.length > 0) {
    const { error: jobsError } = await supabase
      .from("email_jobs")
      .insert(jobsToQueue);
      
    if (jobsError) throw new Error("Failed to queue email jobs: " + jobsError.message);
  }

  // 6. Update Campaign Status
  // Auth bypassed, user is null
  const userId = null;

  const { error: updateCampError } = await supabase
    .from("campaigns")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: userId,
    })
    .eq("id", campaignId);

  if (updateCampError) throw updateCampError;

  // 7. Write Activity Log
  await supabase.from("activity_logs").insert({
    workspace_id: workspace.workspace_id,
    user_id: userId,
    action: "campaign_approved",
    details: {
      campaign_id: campaignId,
      total_approved: validRecipientsToUpdate.length,
      total_suppressed: invalidRecipientsToStop.length
    }
  });

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  revalidatePath(`/dashboard/campaigns/${campaignId}/review`);
  
  return { success: true };
}
