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

  // If it's a draft or ready, redirect to Review page
  if (campaign.status === "draft" || campaign.status === "ready") {
    redirect(`/dashboard/campaigns/${params.id}/review`);
  }

  // 2. Aggregate Stats from campaign_recipients and email_jobs
  const { data: recipients } = await supabase
    .from("campaign_recipients")
    .select("id, status, status_detail, replied_at, follow_up_step, leads(email, full_name)")
    .eq("campaign_id", params.id)
    .eq("workspace_id", workspace.workspace_id);

  const recipientList = recipients || [];
  const recipientIds = recipientList.map((r) => r.id);

  const jobs: { status: string; job_type: string }[] = [];
  if (recipientIds.length > 0) {
    const chunkSize = 200;
    for (let i = 0; i < recipientIds.length; i += chunkSize) {
      const chunk = recipientIds.slice(i, i + chunkSize);
      const { data: jobData } = await supabase
        .from("email_jobs")
        .select("status, job_type")
        .in("campaign_recipient_id", chunk);
      if (jobData) {
        jobs.push(...jobData);
      }
    }
  }

  const total = recipientList.length;
  
  // A job is pending if it's queued
  const pendingJobs = jobs.filter((j) => j.status === "queued");
  
  const pending = pendingJobs.filter(j => j.job_type === "initial").length + recipientList.filter((r) => r.status === "pending" || r.status === "ready").length;
  const processing = jobs.filter((j) => j.status === "processing").length;
  const sent = jobs.filter((j) => j.job_type === "initial" && j.status === "sent").length;
  const followUpSent = jobs.filter((j) => (j.job_type === "follow_up_1" || j.job_type === "follow_up_2") && j.status === "sent").length;
  const followUpDue = pendingJobs.filter(j => j.job_type === "follow_up_1" || j.job_type === "follow_up_2").length;
  
  const failed = recipientList.filter((r) => r.status === "failed" || r.status === "bounced").length;
  const cancelled = recipientList.filter((r) => r.status === "stopped").length + jobs.filter((j) => j.status === "cancelled").length;
  const replied = recipientList.filter((r) => r.status === "replied" || r.replied_at !== null).length;
  const unsubscribed = recipientList.filter((r) => r.status === "unsubscribed").length;
  
  // noReply: Recipients who received at least one email, but haven't replied or unsubscribed
  const noReply = recipientList.filter((r) => r.status === "sent" && r.replied_at === null).length;

  const stats = {
    total,
    pending,
    processing,
    sent,
    failed,
    cancelled,
    replied,
    followUpDue,
    followUpSent,
    unsubscribed,
    noReply
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <DashboardClient campaign={campaign} stats={stats} recipientList={recipientList} jobs={jobs} />
    </div>
  );
}
