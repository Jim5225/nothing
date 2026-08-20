"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

export async function getGlobalMetrics() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();
  const workspaceId = workspace.workspace_id;

  // Real Database queries
  const [
    leadsResp,
    sentResp,
    failedResp,
    repliesResp,
    interestedResp,
    meetingsResp,
    wonResp,
    newLeadsResp,
    contactedResp,
    lostResp,
    campaignsResp,
    accountsResp,
  ] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("campaign_recipients").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "sent"),
    supabase.from("campaign_recipients").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "failed"),
    supabase.from("replies").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "interested"),
    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "won"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "new"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "contacted"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "lost"),
    supabase.from("campaigns").select("id, status").eq("workspace_id", workspaceId),
    supabase.from("email_accounts").select("id, status").eq("workspace_id", workspaceId),
  ]);

  const campaignsList = campaignsResp.data || [];
  const accountsList = accountsResp.data || [];

  return {
    totalLeads: leadsResp.count || 0,
    emailsSent: sentResp.count || 0,
    emailsFailed: failedResp.count || 0,
    replies: repliesResp.count || 0,
    interested: interestedResp.count || 0,
    meetings: meetingsResp.count || 0,
    won: wonResp.count || 0,
    pipeline: {
      new: newLeadsResp.count || 0,
      contacted: contactedResp.count || 0,
      replied: repliesResp.count || 0,
      interested: interestedResp.count || 0,
      meeting: meetingsResp.count || 0,
      won: wonResp.count || 0,
      lost: lostResp.count || 0,
    },
    totalCampaigns: campaignsList.length,
    activeCampaigns: campaignsList.filter(c => c.status === "sending" || c.status === "approved").length,
    connectedAccounts: accountsList.filter(a => a.status === "connected").length,
  };
}

export async function getCampaignMetrics() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();
  
  // We need to fetch campaigns and their recipient stats.
  // Using a single query with relations
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select(`
      id,
      name,
      status,
      campaign_recipients (
        id,
        status,
        replies ( id, is_interested ),
        leads ( status )
      )
    `)
    .eq("workspace_id", workspace.workspace_id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const result = campaigns.map((camp: Record<string, unknown> & { id: string, name: string, status: string, campaign_recipients?: Array<Record<string, unknown> & { status: string, replies?: Array<{is_interested: boolean}>, leads?: {status: string} | Array<{status: string}> }> }) => {
    let recipientsCount = 0;
    let sentCount = 0;
    let failedCount = 0;
    let repliesCount = 0;
    let interestedCount = 0;
    let meetingsCount = 0;
    let wonCount = 0;

    for (const rec of camp.campaign_recipients || []) {
      recipientsCount++;
      if (rec.status === "sent") sentCount++;
      if (rec.status === "failed") failedCount++;
      
      const recReplies = rec.replies || [];
      if (recReplies.length > 0) repliesCount++;
      
      // Check interested from replies
      if (recReplies.some((r) => r.is_interested)) interestedCount++;

      // Lead status metrics (won, meeting)
      // Array if one-to-many, object if one-to-one
      const lead = Array.isArray(rec.leads) ? rec.leads[0] : rec.leads;
      if (lead) {
        if (lead.status === "meeting") meetingsCount++;
        if (lead.status === "won") wonCount++;
      }
    }

    return {
      id: camp.id,
      name: camp.name,
      status: camp.status,
      recipients: recipientsCount,
      sent: sentCount,
      failed: failedCount,
      replies: repliesCount,
      interested: interestedCount,
      meetings: meetingsCount,
      won: wonCount,
    };
  });

  return result;
}
