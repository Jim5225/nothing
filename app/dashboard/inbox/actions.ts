"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

export async function getInboxReplies() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("replies")
    .select(`
      *,
      leads (id, full_name, company_name, email),
      campaigns (id, name, booking_url),
      campaign_recipients (id, status, rendered_subject, rendered_body, sent_at)
    `)
    .eq("workspace_id", workspace.workspace_id)
    .order("received_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function markReplyRead(replyId: string, isRead: boolean) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();
  await supabase
    .from("replies")
    .update({ is_read: isRead })
    .eq("id", replyId)
    .eq("workspace_id", workspace.workspace_id);

  revalidatePath("/dashboard/inbox");
}

export async function markReplyInterested(replyId: string, isInterested: boolean) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();
  
  // Update the reply
  await supabase
    .from("replies")
    .update({ is_interested: isInterested })
    .eq("id", replyId)
    .eq("workspace_id", workspace.workspace_id);

  if (isInterested) {
    // Find the lead ID for this reply
    const { data: reply } = await supabase
      .from("replies")
      .select("lead_id")
      .eq("id", replyId)
      .single();

    if (reply?.lead_id) {
      await supabase
        .from("leads")
        .update({ status: "interested" })
        .eq("id", reply.lead_id)
        .eq("workspace_id", workspace.workspace_id);
    }
  }

  revalidatePath("/dashboard/inbox");
}

export async function stopCampaignForLead(recipientId: string) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();
  
  // Mark recipient as stopped
  const { error } = await supabase
    .from("campaign_recipients")
    .update({ 
      status: "stopped", 
      stop_reason: "Manually stopped from inbox",
      stopped_at: new Date().toISOString()
    })
    .eq("id", recipientId)
    .eq("workspace_id", workspace.workspace_id)
    .neq("status", "sent") // can only stop if not fully finished
    .neq("status", "replied"); // or replied

  if (error) throw error;
  
  // Cancel queued jobs
  await supabase
    .from("email_jobs")
    .update({ status: "cancelled" })
    .eq("campaign_recipient_id", recipientId)
    .eq("status", "queued");

  revalidatePath("/dashboard/inbox");
}
