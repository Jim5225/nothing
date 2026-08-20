"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Pause, 
  Play, 
  XCircle, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquare, 
  Ban, 
  RotateCw,
  Loader2
} from "lucide-react";
import { pauseCampaign, resumeCampaign, cancelCampaign } from "../state-actions";

interface Stats {
  total: number;
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  cancelled: number;
  replied: number;
}

export function DashboardClient({
  campaign,
  stats,
}: {
  campaign: Record<string, unknown> & {
    id: string;
    name: string;
    status: string;
    email_accounts?: { email_address?: string };
  };
  stats: Stats;
}) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTriggeringWorker, setIsTriggeringWorker] = useState(false);

  const handlePause = async () => {
    setIsProcessing(true);
    try {
      await pauseCampaign(campaign.id);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Failed to pause campaign.");
    }
    setIsProcessing(false);
  };

  const handleResume = async () => {
    setIsProcessing(true);
    try {
      await resumeCampaign(campaign.id);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Failed to resume campaign.");
    }
    setIsProcessing(false);
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel? Remaining queued emails will be aborted forever.")) {
      return;
    }
    setIsProcessing(true);
    try {
      await cancelCampaign(campaign.id);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Failed to cancel campaign.");
    }
    setIsProcessing(false);
  };

  const handleTriggerWorker = async () => {
    setIsTriggeringWorker(true);
    try {
      const res = await fetch("/api/worker/process-emails", { method: "POST" });
      const data = await res.json();
      if (data.processed !== undefined) {
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsTriggeringWorker(false);
    }
  };

  const getStatusBadge = () => {
    switch (campaign.status) {
      case "approved":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Approved (Queued)</Badge>;
      case "sending":
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200 animate-pulse">Sending</Badge>;
      case "paused":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Paused</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Completed</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Cancelled</Badge>;
      default:
        return <Badge>{campaign.status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{campaign.name}</h1>
            {getStatusBadge()}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Sender Account: <span className="font-medium text-gray-700">{campaign.email_accounts?.email_address || "Connected Gmail"}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerWorker}
            disabled={isTriggeringWorker}
            className="text-xs"
            title="Trigger background worker queue"
          >
            {isTriggeringWorker ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-purple-600" />
            ) : (
              <RotateCw className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
            )}
            Process Queue Now
          </Button>

          {campaign.status === "sending" && (
            <Button variant="outline" size="sm" onClick={handlePause} disabled={isProcessing}>
              <Pause className="w-4 h-4 mr-1.5" /> Pause
            </Button>
          )}

          {(campaign.status === "paused" || campaign.status === "approved") && (
            <Button
              size="sm"
              onClick={handleResume}
              disabled={isProcessing}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Play className="w-4 h-4 mr-1.5" /> {campaign.status === "approved" ? "Start Campaign" : "Resume"}
            </Button>
          )}

          {(campaign.status === "approved" || campaign.status === "sending" || campaign.status === "paused") && (
            <Button variant="destructive" size="sm" onClick={handleCancel} disabled={isProcessing}>
              <XCircle className="w-4 h-4 mr-1.5" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {/* 7 Sending Progress Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Total */}
        <Card className="bg-slate-50/70 border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Recipients
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card className="bg-blue-50/50 border-blue-100">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600">
              <Clock className="w-3.5 h-3.5" /> Pending / Queued
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{stats.pending}</div>
          </CardContent>
        </Card>

        {/* Processing */}
        <Card className="bg-purple-50/50 border-purple-100">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-purple-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">{stats.processing}</div>
          </CardContent>
        </Card>

        {/* Sent */}
        <Card className="bg-green-50/50 border-green-100">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-green-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> Sent & Delivered
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{stats.sent}</div>
          </CardContent>
        </Card>

        {/* Replied */}
        <Card className="bg-indigo-50/50 border-indigo-100">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600">
              <MessageSquare className="w-3.5 h-3.5" /> Replied
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-700">{stats.replied}</div>
          </CardContent>
        </Card>

        {/* Failed */}
        <Card className="bg-red-50/50 border-red-100">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-600">
              <AlertCircle className="w-3.5 h-3.5" /> Failed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{stats.failed}</div>
          </CardContent>
        </Card>

        {/* Cancelled / Stopped */}
        <Card className="bg-orange-50/50 border-orange-100">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-orange-600">
              <Ban className="w-3.5 h-3.5" /> Cancelled / Stopped
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{stats.cancelled}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
