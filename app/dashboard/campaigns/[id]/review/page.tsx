import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { redirect } from "next/navigation";
import { ReviewClient } from "./review-client";

export const metadata = {
  title: "Campaign Review | Veltrix",
};

export default async function CampaignReviewPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const workspace = await getCurrentWorkspace();
  if (!workspace) redirect("/login");

  const supabase = await createClient();

  // Fetch campaign
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*, email_accounts(email_address, status)")
    .eq("id", params.id)
    .eq("workspace_id", workspace.workspace_id)
    .single();

  if (!campaign) redirect("/dashboard/campaigns");

  // Fetch all connected email accounts for selection
  const { data: accounts } = await supabase
    .from("email_accounts")
    .select("id, email_address")
    .eq("workspace_id", workspace.workspace_id)
    .eq("status", "connected");

  // Fetch recipients
  const { data: recipients } = await supabase
    .from("campaign_recipients")
    .select("*, leads(*)")
    .eq("campaign_id", params.id)
    .eq("workspace_id", workspace.workspace_id)
    .neq("status", "stopped"); // exclude stopped

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full h-[calc(100vh-6rem)]">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review: {campaign.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review your rendered emails and select a sending account before approval.
          </p>
        </div>
      </div>

      <ReviewClient 
        campaign={campaign} 
        recipients={recipients || []} 
        emailAccounts={accounts || []} 
      />
    </div>
  );
}
