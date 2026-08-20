"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

export async function pauseCampaign(id: string) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({ status: "paused" })
    .eq("id", id)
    .eq("workspace_id", workspace.workspace_id)
    .eq("status", "sending");

  if (error) throw error;
  revalidatePath("/dashboard/campaigns");
  revalidatePath(`/dashboard/campaigns/${id}`);
}

export async function resumeCampaign(id: string) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({ status: "sending" })
    .eq("id", id)
    .eq("workspace_id", workspace.workspace_id)
    .eq("status", "paused");

  if (error) throw error;
  revalidatePath("/dashboard/campaigns");
  revalidatePath(`/dashboard/campaigns/${id}`);
}

export async function cancelCampaign(id: string) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();
  // Mark campaign cancelled
  const { error } = await supabase
    .from("campaigns")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("workspace_id", workspace.workspace_id)
    .in("status", ["approved", "sending", "paused"]);

  if (error) throw error;

  // Cancel queued jobs
  // We must first find all recipient IDs for this campaign
  const { data: recs } = await supabase
    .from("campaign_recipients")
    .select("id")
    .eq("campaign_id", id);
    
  if (recs && recs.length > 0) {
    await supabase
      .from("email_jobs")
      .update({ status: "cancelled" })
      .in("campaign_recipient_id", recs.map(r => r.id))
      .in("status", ["queued"]);
  }

  revalidatePath("/dashboard/campaigns");
  revalidatePath(`/dashboard/campaigns/${id}`);
}
