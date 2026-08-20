import { getLeads } from "../../leads/actions";
import { CampaignEditor } from "./campaign-editor";

export const metadata = {
  title: "New Campaign | Veltrix",
};

export default async function NewCampaignPage() {
  // Fetch up to 1000 leads for MVP selection
  const { data: leads } = await getLeads(1, 1000);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-20">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create Campaign</h1>
        <p className="text-sm text-gray-500 mt-1">
          Select leads, write your email template, and save as draft.
        </p>
      </div>

      <CampaignEditor leads={leads || []} />
    </div>
  );
}
