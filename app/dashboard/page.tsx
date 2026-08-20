import { createClient } from "@/lib/supabase/server";
import {
  Users,
  MessageSquare,
  Calendar,
  ArrowRight,
  Send,
  Sparkles,
  Plus,
  Zap,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getGlobalMetrics } from "@/app/dashboard/analytics/actions";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch first workspace directly since we bypassed user auth
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  let metrics = null;
  try {
    metrics = await getGlobalMetrics();
  } catch (err) {
    console.error("Failed to fetch global metrics for dashboard", err);
  }

  const statCards = [
    {
      label: "Total Leads",
      value: metrics?.totalLeads || 0,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
      pill: "Audience Pool",
    },
    {
      label: "Emails Sent",
      value: metrics?.emailsSent || 0,
      icon: Send,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-100",
      pill: "Outreach Volume",
    },
    {
      label: "Replies Received",
      value: metrics?.replies || 0,
      icon: MessageSquare,
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-100",
      pill: "Engagement",
    },
    {
      label: "Meetings Booked",
      value: metrics?.meetings || 0,
      icon: Calendar,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      pill: "Qualified Pipeline",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Welcome Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-7 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-72 h-72 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="bg-gradient-to-r from-blue-500/30 to-purple-500/30 text-blue-300 border border-blue-400/30 text-xs px-3 py-0.5 rounded-full font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Outbound Mission Control
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Workspace: {workspace?.name || "Veltrix"}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Welcome to Veltrix Outbound
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Your high-converting cold email engine. Upload your leads, compose your master email, and start sending automated personalized outreach.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              asChild
              className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold shadow-lg shadow-indigo-500/30 border-0 transition-all scale-100 hover:scale-[1.02] px-5 py-2.5 h-auto"
            >
              <Link href="/dashboard/campaigns/new">
                <Plus className="w-4 h-4 mr-2" />
                Launch Campaign
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`bg-white rounded-2xl border ${card.border} p-5 shadow-xs hover:shadow-md transition-all group`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {card.label}
              </span>
              <div className={`p-2.5 rounded-xl ${card.bg} group-hover:scale-110 transition-transform`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black text-slate-900">
                {card.value}
              </span>
              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {card.pill}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Quick Outbound Actions
            </h2>
            <p className="text-xs text-slate-500">Fast shortcuts to common agency workflow steps.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/dashboard/leads/import"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-xs transition-all group bg-slate-50/30"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Import Leads</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload CSV, Excel, or Markdown
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </Link>
          
          <Link
            href="/dashboard/campaigns/new"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 hover:shadow-xs transition-all group bg-slate-50/30"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">New Campaign</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Draft & preview master email
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
          </Link>

          <Link
            href="/dashboard/analytics"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-xs transition-all group bg-slate-50/30"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">View Analytics</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Conversion funnels & rates
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>
      </div>
    </div>
  );
}
