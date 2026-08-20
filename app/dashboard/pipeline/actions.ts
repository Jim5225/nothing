"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";

export async function getPipelineLeads() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, full_name, email, company_name, status, updated_at")
    .eq("workspace_id", workspace.workspace_id)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function updateLeadStatus(leadId: string, status: string) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", leadId)
    .eq("workspace_id", workspace.workspace_id);

  if (error) throw error;
  
  await logActivity("lead_status_changed", { lead_id: leadId, new_status: status });
  revalidatePath("/dashboard/pipeline");
}

export async function createMeeting(leadId: string, campaignId: string | null, scheduledAt: string, notes: string) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { error } = await supabase
    .from("meetings")
    .insert({
      workspace_id: workspace.workspace_id,
      lead_id: leadId,
      campaign_id: campaignId,
      scheduled_at: scheduledAt,
      status: "scheduled",
      notes: notes
    });

  if (error) throw error;
  
  // Also update lead status to meeting
  await supabase
    .from("leads")
    .update({ status: "meeting" })
    .eq("id", leadId)
    .eq("workspace_id", workspace.workspace_id);

  await logActivity("meeting_created", { lead_id: leadId, scheduled_at: scheduledAt });
  await logActivity("lead_status_changed", { lead_id: leadId, new_status: "meeting" });

  revalidatePath("/dashboard/pipeline");
}
