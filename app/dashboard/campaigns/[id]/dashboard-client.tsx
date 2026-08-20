"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pause, Play, XCircle, Send, Clock, XOctagon } from "lucide-react";
import { pauseCampaign, resumeCampaign, cancelCampaign } from "../state-actions";

interface Stats {
  total: number;
  queued: number;
  sent: number;
  failed: number;
  cancelled: number;
}

export function DashboardClient({ campaign, stats }: { campaign: Record<string, unknown> & { id: string, name: string, status: string, email_accounts?: { email_address?: string } }; stats: Stats }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePause = async () => {
    setIsProcessing(true);
    try {
      await pauseCampaign(campaign.id);
    } catch(e) {
      console.error(e);
    }
    setIsProcessing(false);
  };

  const handleResume = async () => {
    setIsProcessing(true);
    try {
      await resumeCampaign(campaign.id);
    } catch(e) {
      console.error(e);
    }
    setIsProcessing(false);
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel? Remaining queued emails will be aborted forever.")) return;
    setIsProcessing(true);
    try {
      await cancelCampaign(campaign.id);
    } catch(e) {
      console.error(e);
    }
    setIsProcessing(false);
  };

  const getStatusBadge = () => {
    switch(campaign.status) {
      case "approved": return <Badge className="bg-blue-100 text-blue-800">Approved</Badge>;
      case "sending": return <Badge className="bg-purple-100 text-purple-800">Sending</Badge>;
      case "paused": return <Badge className="bg-yellow-100 text-yellow-800">Paused</Badge>;
      case "completed": return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "cancelled": return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
      default: return <Badge>{campaign.status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
            {getStatusBadge()}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Sending via {campaign.email_accounts?.email_address || "Unknown"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === "sending" && (
            <Button variant="outline" size="sm" onClick={handlePause} disabled={isProcessing}>
              <Pause className="w-4 h-4 mr-2" /> Pause
            </Button>
          )}
          {(campaign.status === "paused" || campaign.status === "approved") && (
            <Button variant="outline" size="sm" onClick={handleResume} disabled={isProcessing}>
              <Play className="w-4 h-4 mr-2" /> {campaign.status === "approved" ? "Start Sending" : "Resume"}
            </Button>
          )}
          {(campaign.status === "approved" || campaign.status === "sending" || campaign.status === "paused") && (
            <Button variant="destructive" size="sm" onClick={handleCancel} disabled={isProcessing}>
              <XCircle className="w-4 h-4 mr-2" /> Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="w-4 h-4" /> Queued / Processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.queued}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-green-700">
              <Send className="w-4 h-4" /> Sent Successfully
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">{stats.sent}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-red-700">
              <XOctagon className="w-4 h-4" /> Failed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-700">{stats.failed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-gray-500">
              <XCircle className="w-4 h-4" /> Cancelled
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-700">{stats.cancelled}</div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Delivery Overview</CardTitle>
          <CardDescription>Overall progress for {stats.total} total recipients.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex">
            {stats.total > 0 && (
              <>
                <div style={{ width: `${(stats.sent / stats.total) * 100}%` }} className="bg-green-500 h-full" />
                <div style={{ width: `${(stats.failed / stats.total) * 100}%` }} className="bg-red-500 h-full" />
                <div style={{ width: `${(stats.cancelled / stats.total) * 100}%` }} className="bg-gray-400 h-full" />
                <div style={{ width: `${(stats.queued / stats.total) * 100}%` }} className="bg-blue-400 h-full" />
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
