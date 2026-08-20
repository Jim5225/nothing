import { getPipelineLeads } from "./actions";
import { PipelineClient } from "./pipeline-client";

export const metadata = {
  title: "Pipeline | Veltrix",
};

export default async function PipelinePage() {
  const leads = await getPipelineLeads();

  return (
    <div className="p-8 max-w-[1600px] mx-auto h-[calc(100vh-2rem)] flex flex-col">
      <div className="mb-6 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">Sales Pipeline</h1>
        <p className="text-muted-foreground mt-1">Track your leads and consultation bookings.</p>
      </div>
      
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <PipelineClient initialLeads={leads || []} />
      </div>
    </div>
  );
}
