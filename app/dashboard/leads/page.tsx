import { getLeads } from "./actions";
import { LeadsClient } from "./leads-client";
import { Button } from "@/components/ui/button";
import { Plus, Download, Users } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Leads | Veltrix",
};

export default async function LeadsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const page = typeof searchParams.page === "string" ? parseInt(searchParams.page) : 1;
  const search = typeof searchParams.search === "string" ? searchParams.search : "";

  const limit = 20;

  const { data: leads, count } = await getLeads(page, limit, search);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              Audience Database
            </span>
            <span className="text-xs text-slate-400 font-medium">{count} Total Contacts</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Leads Management</h1>
          <p className="text-sm text-slate-300">
            Organize, search, and manage your prospect lists for cold email outreach.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            asChild
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm font-medium transition-all"
          >
            <Link href="/dashboard/leads/export">
              <Download className="mr-2 h-4 w-4 text-slate-300" />
              Export CSV
            </Link>
          </Button>
          <Button
            asChild
            className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold shadow-md shadow-indigo-500/30 border-0 transition-all scale-100 hover:scale-[1.02]"
          >
            <Link href="/dashboard/leads/import">
              <Plus className="mr-2 h-4 w-4" />
              Import Leads
            </Link>
          </Button>
        </div>
      </div>

      <LeadsClient
        initialLeads={leads}
        totalCount={count}
        currentPage={page}
        searchQuery={search}
      />
    </div>
  );
}

