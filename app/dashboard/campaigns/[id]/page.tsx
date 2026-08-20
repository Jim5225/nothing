import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";

export const metadata = {
  title: "Campaign Dashboard | Veltrix",
};

export default async function CampaignDashboardPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const workspace = await getCurrentWorkspace();
  if (!workspace) redirect("/login");

  const supabase = await createClient();

  // 1. Fetch Campaign
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*, email_accounts(email_address)")
    .eq("id", params.id)
    .eq("workspace_id", workspace.workspace_id)
    .single();

  if (!campaign) redirect("/dashboard/campaigns");

  // If it's a draft or ready, redirect to Review page instead, since it hasn't been approved yet.
  if (campaign.status === "draft" || campaign.status === "ready") {
    redirect(`/dashboard/campaigns/${params.id}/review`);
  }

  // 2. Aggregate Stats from email_jobs
  // In a large system we'd use RPC, but for V1 MVP we can fetch all jobs for this campaign
  // by getting all recipient IDs first.
  const { data: recipients } = await supabase
    .from("campaign_recipients")
    .select("id")
    .eq("campaign_id", params.id);
    
  const recipientIds = recipients?.map(r => r.id) || [];
  
  let jobs: { status: string }[] = [];
  if (recipientIds.length > 0) {
    const { data: jobData } = await supabase
      .from("email_jobs")
      .select("status")
      .in("campaign_recipient_id", recipientIds);
    jobs = jobData || [];
  }

  const stats = {
    total: recipientIds.length,
    queued: jobs.filter(j => j.status === "queued" || j.status === "processing").length,
    sent: jobs.filter(j => j.status === "sent").length,
    failed: jobs.filter(j => j.status === "failed").length,
    cancelled: jobs.filter(j => j.status === "cancelled").length,
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <DashboardClient campaign={campaign} stats={stats} />
    </div>
  );
}
