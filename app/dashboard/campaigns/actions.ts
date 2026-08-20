"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

export async function getCampaigns(page = 1, limit = 20) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // We use standard select, but to get recipient count effectively,
  // we could do a joined query or RPC. For MVP, doing a join on campaign_recipients
  const { data, count, error } = await supabase
    .from("campaigns")
    .select(
      `
      id, name, status, created_at, updated_at,
      campaign_recipients(count)
    `,
      { count: "exact" }
    )
    .eq("workspace_id", workspace.workspace_id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return { data, count: count || 0 };
}

export async function createCampaignDraft(payload: {
  name: string;
  subject: string;
  body: string;
  booking_url?: string;
  sender_name?: string;
  leadIds: string[];
}) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");
  const workspaceId = workspace.workspace_id;

  const supabase = await createClient();

  if (!payload.name || payload.leadIds.length === 0 || !payload.subject || !payload.body) {
    throw new Error("Missing required fields");
  }

  // 1. Create the template
  const { data: template, error: templateError } = await supabase
    .from("email_templates")
    .insert({
      workspace_id: workspaceId,
      name: `${payload.name} Template`,
      subject: payload.subject,
      body: payload.body,
    })
    .select()
    .single();

  if (templateError) throw templateError;

  // 2. Create the campaign
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      workspace_id: workspaceId,
      name: payload.name,
      status: "ready", // as per validation spec: can be ready if all required exist
      template_id: template.id,
      booking_url: payload.booking_url || null,
      sender_name: payload.sender_name || null,
    })
    .select()
    .single();

  if (campaignError) throw campaignError;

  // 3. Create campaign recipients
  const recipients = payload.leadIds.map((leadId) => ({
    workspace_id: workspaceId,
    campaign_id: campaign.id,
    lead_id: leadId,
    status: "pending",
  }));

  const { error: recipientsError } = await supabase
    .from("campaign_recipients")
    .insert(recipients);

  if (recipientsError) throw recipientsError;

  const { logActivity } = await import("@/lib/activity");
  await logActivity("campaign_created", { campaign_id: campaign.id, name: campaign.name });

  revalidatePath("/dashboard/campaigns");
  return campaign.id;
}

export async function getCampaignDetails(id: string) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();

  // Get campaign and template
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select(`
      *,
      email_templates (*)
    `)
    .eq("id", id)
    .eq("workspace_id", workspace.workspace_id)
    .single();

  if (campaignError) throw campaignError;

  // Get recipients with lead details
  const { data: recipients, error: recipientsError } = await supabase
    .from("campaign_recipients")
    .select(`
      *,
      leads (*)
    `)
    .eq("campaign_id", id)
    .eq("workspace_id", workspace.workspace_id);

  if (recipientsError) throw recipientsError;

  return { campaign, recipients };
}
