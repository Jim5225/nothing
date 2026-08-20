import { getGlobalMetrics, getCampaignMetrics } from "./actions";
import { AnalyticsClient } from "./analytics-client";

export const metadata = {
  title: "Analytics | Veltrix",
};

export default async function AnalyticsPage() {
  const globalMetrics = await getGlobalMetrics();
  const campaignMetrics = await getCampaignMetrics();

  return (
    <div className="max-w-7xl mx-auto">
      <AnalyticsClient globalMetrics={globalMetrics} campaignMetrics={campaignMetrics} />
    </div>
  );
}

