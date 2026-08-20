"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Send,
  Mail,
  Trophy,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Flame,
  BarChart3,
  Lightbulb,
} from "lucide-react";

export type GlobalMetrics = {
  totalLeads: number;
  emailsSent: number;
  emailsFailed: number;
  replies: number;
  interested: number;
  meetings: number;
  won: number;
  pipeline?: {
    new: number;
    contacted: number;
    replied: number;
    interested: number;
    meeting: number;
    won: number;
    lost: number;
  };
  totalCampaigns?: number;
  activeCampaigns?: number;
  connectedAccounts?: number;
};

export type CampaignMetric = {
  id: string;
  name: string;
  status: string;
  recipients: number;
  sent: number;
  failed: number;
  replies: number;
  interested: number;
  meetings: number;
  won: number;
};

export function AnalyticsClient({
  globalMetrics,
  campaignMetrics,
}: {
  globalMetrics: GlobalMetrics;
  campaignMetrics: CampaignMetric[];
}) {
  const [filter, setFilter] = useState<"all" | "active" | "draft">("all");

  const totalAttempts = globalMetrics.emailsSent + globalMetrics.emailsFailed;
  const deliverabilityRate =
    totalAttempts > 0
      ? ((globalMetrics.emailsSent / totalAttempts) * 100).toFixed(1)
      : "100.0";
  const failureRate =
    totalAttempts > 0
      ? ((globalMetrics.emailsFailed / totalAttempts) * 100).toFixed(1)
      : "0.0";

  const replyRate =
    globalMetrics.emailsSent > 0
      ? ((globalMetrics.replies / globalMetrics.emailsSent) * 100).toFixed(1)
      : "0.0";

  const interestRate =
    globalMetrics.replies > 0
      ? ((globalMetrics.interested / globalMetrics.replies) * 100).toFixed(1)
      : "0.0";

  const meetingRate =
    globalMetrics.interested > 0
      ? ((globalMetrics.meetings / globalMetrics.interested) * 100).toFixed(1)
      : globalMetrics.replies > 0
      ? ((globalMetrics.meetings / globalMetrics.replies) * 100).toFixed(1)
      : "0.0";

  const winRate =
    globalMetrics.meetings > 0
      ? ((globalMetrics.won / globalMetrics.meetings) * 100).toFixed(1)
      : globalMetrics.interested > 0
      ? ((globalMetrics.won / globalMetrics.interested) * 100).toFixed(1)
      : "0.0";

  // Decision & Recommendations Generation
  const recommendations: Array<{
    type: "critical" | "warning" | "opportunity" | "healthy";
    title: string;
    description: string;
    actionLabel: string;
    actionHref: string;
  }> = [];

  if (globalMetrics.emailsSent === 0) {
    recommendations.push({
      type: "opportunity",
      title: "Launch Your First Campaign",
      description: `You have ${globalMetrics.totalLeads} total leads in your database. Configure and approve a campaign to start generating outreach momentum.`,
      actionLabel: "Create Campaign",
      actionHref: "/dashboard/campaigns/new",
    });
  }

  if (parseFloat(failureRate) > 5.0) {
    recommendations.push({
      type: "critical",
      title: "High Email Failure Rate Detected",
      description: `Your bounce/failure rate is ${failureRate}%. Validate your lead CSVs and verify mailbox sending limits to protect your domain reputation.`,
      actionLabel: "Check Email Settings",
      actionHref: "/settings/email",
    });
  }

  if (globalMetrics.emailsSent >= 20 && parseFloat(replyRate) < 3.0) {
    recommendations.push({
      type: "warning",
      title: "Reply Rate Below Industry Benchmark (3-5%)",
      description: `Current reply rate is ${replyRate}%. Consider shortening your email copy to 3-4 punchy sentences and personalizing subject lines with {{company_name}}.`,
      actionLabel: "Review Campaigns",
      actionHref: "/dashboard/campaigns",
    });
  }

  if (globalMetrics.interested > globalMetrics.meetings && globalMetrics.interested > 0) {
    const unbookedCount = globalMetrics.interested - globalMetrics.meetings;
    recommendations.push({
      type: "opportunity",
      title: `${unbookedCount} Warm Leads Awaiting Meeting Booking`,
      description: `You have ${globalMetrics.interested} interested replies, but only ${globalMetrics.meetings} meetings booked. Follow up immediately with booking links.`,
      actionLabel: "Open Sales Pipeline",
      actionHref: "/dashboard/pipeline",
    });
  }

  if (globalMetrics.totalLeads > 0 && (globalMetrics.pipeline?.new || 0) > 0) {
    recommendations.push({
      type: "healthy",
      title: `${globalMetrics.pipeline?.new || 0} Fresh Leads Ready for Outreach`,
      description: `You have uncontacted leads in your database. Add them to an active campaign queue to maintain continuous pipeline flow.`,
      actionLabel: "View Leads",
      actionHref: "/dashboard/leads",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: "healthy",
      title: "Outbound Engine Running Smoothly",
      description: "Deliverability and conversion benchmarks are optimal. You can safely scale daily sending volume.",
      actionLabel: "View Pipeline",
      actionHref: "/dashboard/pipeline",
    });
  }

  // Filter campaigns
  const filteredCampaigns = campaignMetrics.filter((camp) => {
    if (filter === "active") return camp.status === "sending" || camp.status === "approved";
    if (filter === "draft") return camp.status === "draft" || camp.status === "ready";
    return true;
  });

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Performance & Growth Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time statistical tracking, outbound efficiency ratios, and growth decision indicators.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 bg-white text-gray-700 border-gray-300 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Real Data Source
          </Badge>
          <Link href="/dashboard/pipeline">
            <Button size="sm" variant="default" className="bg-blue-600 hover:bg-blue-700">
              Pipeline Kanban
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Strategic Decision Advisor Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
                Strategic Decision Advisor
              </span>
              <span className="text-xs text-slate-400">AI Growth Recommendations</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {recommendations[0].title}
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              {recommendations[0].description}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <Link href={recommendations[0].actionHref}>
              <Button className="bg-white text-gray-900 hover:bg-slate-100 font-semibold shadow-sm">
                {recommendations[0].actionLabel}
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Key Statistical Ratios Strip */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Key Outbound Efficiency Metrics</h2>
          <span className="text-xs text-gray-500">Calculated from actual database records</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Deliverability Card */}
          <Card className="p-5 border-gray-200 bg-white hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Deliverability Rate
              </span>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Send className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900">{deliverabilityRate}%</span>
              <span className="text-xs font-medium text-emerald-600 flex items-center">
                {parseFloat(deliverabilityRate) >= 95 ? "🟢 Optimal" : "🟡 Monitor"}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {globalMetrics.emailsSent} sent &bull; {globalMetrics.emailsFailed} failed
            </p>
            <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all"
                style={{ width: `${deliverabilityRate}%` }}
              />
            </div>
          </Card>

          {/* Reply Rate Card */}
          <Card className="p-5 border-gray-200 bg-white hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Reply Rate
              </span>
              <div className="p-2 bg-purple-50 rounded-lg">
                <Mail className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-purple-700">{replyRate}%</span>
              <span className="text-xs font-medium text-gray-500">
                (Industry avg: 3-5%)
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {globalMetrics.replies} replies from {globalMetrics.emailsSent} sent
            </p>
            <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-purple-600 h-1.5 rounded-full transition-all"
                style={{ width: `${Math.min(parseFloat(replyRate) * 10, 100)}%` }}
              />
            </div>
          </Card>

          {/* Positive Interest Rate Card */}
          <Card className="p-5 border-gray-200 bg-white hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Positive Interest Rate
              </span>
              <div className="p-2 bg-amber-50 rounded-lg">
                <Flame className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-600">{interestRate}%</span>
              <span className="text-xs font-medium text-emerald-600">
                {globalMetrics.interested} Qualified Leads
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Of all replies, {globalMetrics.interested} showed high interest
            </p>
            <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-amber-500 h-1.5 rounded-full transition-all"
                style={{ width: `${interestRate}%` }}
              />
            </div>
          </Card>

          {/* Win / Conversion Rate Card */}
          <Card className="p-5 border-gray-200 bg-white hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Meeting Conversion Rate
              </span>
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Trophy className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-600">{winRate}%</span>
              <span className="text-xs font-medium text-emerald-700">
                {globalMetrics.won} Closed Won
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {globalMetrics.meetings} meetings booked &bull; {globalMetrics.won} won
            </p>
            <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-1.5 rounded-full transition-all"
                style={{ width: `${winRate}%` }}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Outbound Conversion Funnel */}
      <Card className="border-gray-200 p-6 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Full Outbound Conversion Funnel
            </h3>
            <p className="text-xs text-gray-500">
              Visual breakdown of lead stage progression from database import to revenue close.
            </p>
          </div>
          <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-xs">
            {globalMetrics.totalLeads} Total Prospects
          </Badge>
        </div>

        {/* Funnel Stages */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
          {/* Step 1: Total Leads */}
          <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex flex-col justify-between">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">1. Audience</span>
            <div className="my-2">
              <span className="text-2xl font-black text-gray-900">{globalMetrics.totalLeads}</span>
              <p className="text-[11px] text-gray-500 mt-0.5">Total in DB</p>
            </div>
            <span className="text-[10px] font-medium bg-blue-100 text-blue-800 py-0.5 px-2 rounded-full mx-auto">
              100% Base
            </span>
          </div>

          {/* Step 2: Contacted / Sent */}
          <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 flex flex-col justify-between">
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">2. Contacted</span>
            <div className="my-2">
              <span className="text-2xl font-black text-gray-900">{globalMetrics.emailsSent}</span>
              <p className="text-[11px] text-gray-500 mt-0.5">Emails Sent</p>
            </div>
            <span className="text-[10px] font-medium bg-indigo-100 text-indigo-800 py-0.5 px-2 rounded-full mx-auto">
              {globalMetrics.totalLeads > 0 ? ((globalMetrics.emailsSent / globalMetrics.totalLeads) * 100).toFixed(0) : 0}% of Audience
            </span>
          </div>

          {/* Step 3: Replied */}
          <div className="p-4 rounded-xl border border-purple-100 bg-purple-50/50 flex flex-col justify-between">
            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">3. Replied</span>
            <div className="my-2">
              <span className="text-2xl font-black text-purple-900">{globalMetrics.replies}</span>
              <p className="text-[11px] text-gray-500 mt-0.5">Responses</p>
            </div>
            <span className="text-[10px] font-medium bg-purple-100 text-purple-800 py-0.5 px-2 rounded-full mx-auto">
              {replyRate}% Response
            </span>
          </div>

          {/* Step 4: Interested */}
          <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/50 flex flex-col justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">4. Interested</span>
            <div className="my-2">
              <span className="text-2xl font-black text-amber-900">{globalMetrics.interested}</span>
              <p className="text-[11px] text-gray-500 mt-0.5">Warm Leads</p>
            </div>
            <span className="text-[10px] font-medium bg-amber-100 text-amber-800 py-0.5 px-2 rounded-full mx-auto">
              {interestRate}% Qualified
            </span>
          </div>

          {/* Step 5: Meetings */}
          <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 flex flex-col justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">5. Meetings</span>
            <div className="my-2">
              <span className="text-2xl font-black text-emerald-900">{globalMetrics.meetings}</span>
              <p className="text-[11px] text-gray-500 mt-0.5">Calls Booked</p>
            </div>
            <span className="text-[10px] font-medium bg-emerald-100 text-emerald-800 py-0.5 px-2 rounded-full mx-auto">
              {meetingRate}% Booked
            </span>
          </div>

          {/* Step 6: Won */}
          <div className="p-4 rounded-xl border border-green-200 bg-green-50 flex flex-col justify-between shadow-xs">
            <span className="text-xs font-bold text-green-800 uppercase tracking-wider">6. Closed Won</span>
            <div className="my-2">
              <span className="text-2xl font-black text-green-700">{globalMetrics.won}</span>
              <p className="text-[11px] text-gray-600 mt-0.5">Deals Closed</p>
            </div>
            <span className="text-[10px] font-semibold bg-green-600 text-white py-0.5 px-2 rounded-full mx-auto">
              {winRate}% Won
            </span>
          </div>
        </div>
      </Card>

      {/* Pipeline Distribution Section */}
      {globalMetrics.pipeline && (
        <Card className="p-6 border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Lead Pipeline Volume Distribution</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Current status of all {globalMetrics.totalLeads} prospects across the outbound lifecycle.
              </p>
            </div>
            <Link href="/dashboard/pipeline" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Open Kanban Board
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Distribution Stacked Bar */}
          <div className="space-y-3">
            <div className="h-4 w-full bg-gray-100 rounded-full flex overflow-hidden">
              {globalMetrics.totalLeads > 0 && (
                <>
                  <div
                    title={`New: ${globalMetrics.pipeline.new}`}
                    style={{ width: `${(globalMetrics.pipeline.new / globalMetrics.totalLeads) * 100}%` }}
                    className="bg-blue-400 hover:opacity-90 transition-all"
                  />
                  <div
                    title={`Contacted: ${globalMetrics.pipeline.contacted}`}
                    style={{ width: `${(globalMetrics.pipeline.contacted / globalMetrics.totalLeads) * 100}%` }}
                    className="bg-indigo-500 hover:opacity-90 transition-all"
                  />
                  <div
                    title={`Replied: ${globalMetrics.pipeline.replied}`}
                    style={{ width: `${(globalMetrics.pipeline.replied / globalMetrics.totalLeads) * 100}%` }}
                    className="bg-purple-500 hover:opacity-90 transition-all"
                  />
                  <div
                    title={`Interested: ${globalMetrics.pipeline.interested}`}
                    style={{ width: `${(globalMetrics.pipeline.interested / globalMetrics.totalLeads) * 100}%` }}
                    className="bg-amber-500 hover:opacity-90 transition-all"
                  />
                  <div
                    title={`Meeting: ${globalMetrics.pipeline.meeting}`}
                    style={{ width: `${(globalMetrics.pipeline.meeting / globalMetrics.totalLeads) * 100}%` }}
                    className="bg-emerald-500 hover:opacity-90 transition-all"
                  />
                  <div
                    title={`Won: ${globalMetrics.pipeline.won}`}
                    style={{ width: `${(globalMetrics.pipeline.won / globalMetrics.totalLeads) * 100}%` }}
                    className="bg-green-600 hover:opacity-90 transition-all"
                  />
                  <div
                    title={`Lost: ${globalMetrics.pipeline.lost}`}
                    style={{ width: `${(globalMetrics.pipeline.lost / globalMetrics.totalLeads) * 100}%` }}
                    className="bg-gray-400 hover:opacity-90 transition-all"
                  />
                </>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span className="text-gray-600">New ({globalMetrics.pipeline.new})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span className="text-gray-600">Contacted ({globalMetrics.pipeline.contacted})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span className="text-gray-600">Replied ({globalMetrics.pipeline.replied})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-gray-600">Interested ({globalMetrics.pipeline.interested})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-gray-600">Meeting ({globalMetrics.pipeline.meeting})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-600" />
                <span className="text-gray-600">Won ({globalMetrics.pipeline.won})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                <span className="text-gray-600">Lost ({globalMetrics.pipeline.lost})</span>
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Campaign Statistical Benchmark Matrix */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Campaign Performance & Statistical Matrix</h2>
            <p className="text-xs text-gray-500">
              Comparative analytics across individual cold outreach campaigns.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              className={filter === "all" ? "bg-gray-900 text-white" : ""}
              onClick={() => setFilter("all")}
            >
              All ({campaignMetrics.length})
            </Button>
            <Button
              size="sm"
              variant={filter === "active" ? "default" : "outline"}
              className={filter === "active" ? "bg-gray-900 text-white" : ""}
              onClick={() => setFilter("active")}
            >
              Active
            </Button>
            <Button
              size="sm"
              variant={filter === "draft" ? "default" : "outline"}
              className={filter === "draft" ? "bg-gray-900 text-white" : ""}
              onClick={() => setFilter("draft")}
            >
              Drafts
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase text-[11px] font-semibold tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Campaign Name</th>
                  <th className="px-4 py-3.5 text-center">Audience</th>
                  <th className="px-4 py-3.5 text-center">Sent</th>
                  <th className="px-4 py-3.5 text-center">Reply Rate</th>
                  <th className="px-4 py-3.5 text-center">Positive Rate</th>
                  <th className="px-4 py-3.5 text-center">Meetings</th>
                  <th className="px-4 py-3.5 text-center">Won</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      <div className="max-w-xs mx-auto space-y-2">
                        <BarChart3 className="w-8 h-8 text-gray-300 mx-auto" />
                        <p className="font-medium text-gray-700">No campaigns found in this view</p>
                        <p className="text-xs text-gray-400">
                          Create a campaign or approve drafts to start generating comparative statistics.
                        </p>
                        <Link href="/dashboard/campaigns/new" className="inline-block pt-2">
                          <Button size="sm" variant="outline">Create New Campaign</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCampaigns.map((camp) => {
                    const campReplyRate =
                      camp.sent > 0 ? ((camp.replies / camp.sent) * 100).toFixed(1) : "0.0";
                    const campInterestRate =
                      camp.replies > 0 ? ((camp.interested / camp.replies) * 100).toFixed(1) : "0.0";

                    return (
                      <tr key={camp.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{camp.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className={
                                camp.status === "sending"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : camp.status === "approved"
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : camp.status === "completed"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-gray-50 text-gray-600 border-gray-200"
                              }
                            >
                              {camp.status}
                            </Badge>
                            {camp.failed > 0 && (
                              <span className="text-[11px] text-red-600 font-medium">
                                {camp.failed} failed
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4 text-center font-medium text-gray-700">
                          {camp.recipients}
                        </td>

                        <td className="px-4 py-4 text-center font-semibold text-indigo-600">
                          {camp.sent}
                        </td>

                        <td className="px-4 py-4 text-center">
                          <div className="font-bold text-purple-700">{campReplyRate}%</div>
                          <span className="text-[10px] text-gray-400">({camp.replies} replies)</span>
                        </td>

                        <td className="px-4 py-4 text-center">
                          <div className="font-bold text-amber-600">{campInterestRate}%</div>
                          <span className="text-[10px] text-gray-400">({camp.interested} warm)</span>
                        </td>

                        <td className="px-4 py-4 text-center font-semibold text-emerald-600">
                          {camp.meetings}
                        </td>

                        <td className="px-4 py-4 text-center font-bold text-green-700">
                          {camp.won}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <Link href={`/dashboard/campaigns/${camp.id}/review`}>
                            <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                              Review
                              <ArrowRight className="w-3.5 h-3.5 ml-1" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

