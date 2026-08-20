import { getCampaigns } from "./actions";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Campaigns | Veltrix",
};

function getStatusColor(status: string) {
  switch (status) {
    case "draft":
      return "bg-gray-100 text-gray-800";
    case "ready":
      return "bg-blue-100 text-blue-800";
    case "approved":
    case "sending":
      return "bg-purple-100 text-purple-800";
    case "completed":
      return "bg-green-100 text-green-800";
    case "paused":
      return "bg-yellow-100 text-yellow-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default async function CampaignsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const page = typeof searchParams.page === "string" ? parseInt(searchParams.page) : 1;
  const limit = 20;

  const { data: campaigns } = await getCampaigns(page, limit);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Aesthetic Hero Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="bg-purple-500/20 text-purple-300 border border-purple-400/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
              Outbound Engine
            </span>
            <span className="text-xs text-slate-400 font-medium">{campaigns.length} Total Campaigns</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Outreach Campaigns</h1>
          <p className="text-sm text-slate-300">
            Create, preview, and monitor high-converting personalized email campaigns.
          </p>
        </div>
        <div className="relative z-10 shrink-0">
          <Button
            asChild
            className="bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-semibold shadow-md shadow-purple-500/30 border-0 transition-all scale-100 hover:scale-[1.02]"
          >
            <Link href="/dashboard/campaigns/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Campaign
            </Link>
          </Button>
        </div>
      </div>

      <div className="border border-slate-200/90 rounded-xl bg-white overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="font-semibold text-slate-700">Campaign Name</TableHead>
              <TableHead className="font-semibold text-slate-700">Status</TableHead>
              <TableHead className="font-semibold text-slate-700">Recipients</TableHead>
              <TableHead className="font-semibold text-slate-700">Created</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                  <div className="max-w-xs mx-auto space-y-2">
                    <p className="font-medium text-slate-700">No campaigns created yet</p>
                    <p className="text-xs text-slate-400">Launch your first cold email outreach campaign in 2 minutes.</p>
                    <Button asChild size="sm" className="bg-purple-600 hover:bg-purple-700 mt-2">
                      <Link href="/dashboard/campaigns/new">Create Your First Campaign</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((campaign) => {
                const recipientCount = Array.isArray(campaign.campaign_recipients) 
                  ? campaign.campaign_recipients[0]?.count 
                  : 0;

                return (
                  <TableRow key={campaign.id} className="hover:bg-slate-50/60 transition-colors">
                    <TableCell className="font-semibold text-slate-900">{campaign.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`capitalize font-medium ${getStatusColor(campaign.status)}`}
                      >
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-slate-700">{recipientCount || 0}</TableCell>
                    <TableCell className="text-slate-400 text-xs">
                      {new Date(campaign.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 font-medium">
                        <Link href={`/dashboard/campaigns/${campaign.id}/review`}>
                          Review & Send
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
