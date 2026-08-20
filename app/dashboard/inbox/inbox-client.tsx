"use client";

import { useState } from "react";
import { markReplyRead, markReplyInterested, stopCampaignForLead } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  XCircle, 
  Mail, 
  ExternalLink, 
  User, 
  Star,
  Copy
} from "lucide-react";

type Reply = {
  id: string;
  is_read: boolean;
  is_interested: boolean;
  received_at: string;
  from_email: string;
  subject: string;
  body: string;
  campaign_recipient_id: string;
  leads?: { full_name: string; company_name: string; email: string };
  campaigns?: { name: string; booking_url: string };
  campaign_recipients?: { sent_at: string; rendered_subject: string; rendered_body: string };
};

const formatDistance = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const formatDate = (dateStr: string) => {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dateStr));
};

export function InboxClient({ initialReplies }: { initialReplies: Reply[] }) {
  const [replies, setReplies] = useState<Reply[]>(initialReplies);
  const [selectedReplyId, setSelectedReplyId] = useState<string | null>(null);

  const selectedReply = replies.find(r => r.id === selectedReplyId);

  const handleSelect = async (reply: Reply) => {
    setSelectedReplyId(reply.id);
    if (!reply.is_read) {
      await markReplyRead(reply.id, true);
      setReplies(replies.map(r => r.id === reply.id ? { ...r, is_read: true } : r));
    }
  };

  const handleToggleInterested = async () => {
    if (!selectedReply) return;
    const newStatus = !selectedReply.is_interested;
    await markReplyInterested(selectedReply.id, newStatus);
    setReplies(replies.map(r => r.id === selectedReply.id ? { ...r, is_interested: newStatus } : r));
  };

  const handleStopCampaign = async () => {
    if (!selectedReply?.campaign_recipient_id) return;
    await stopCampaignForLead(selectedReply.campaign_recipient_id);
    alert("Campaign stopped for this lead");
  };

  const handleCopyEmail = () => {
    if (!selectedReply) return;
    navigator.clipboard.writeText(selectedReply.from_email);
  };

  return (
    <div className="flex h-full border rounded-xl overflow-hidden bg-background shadow-sm">
      {/* Left List Pane */}
      <div className="w-1/3 border-r flex flex-col h-full bg-muted/10">
        <div className="p-4 border-b bg-background">
          <h2 className="font-semibold text-lg flex items-center justify-between">
            Conversations
            <Badge variant="secondary">{replies.filter(r => !r.is_read).length} unread</Badge>
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {replies.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No replies yet.
            </div>
          ) : (
            replies.map((reply) => (
              <button
                key={reply.id}
                onClick={() => handleSelect(reply)}
                className={`w-full text-left p-4 rounded-lg transition-colors border ${
                  selectedReplyId === reply.id 
                    ? "bg-primary/5 border-primary/20" 
                    : !reply.is_read 
                      ? "bg-background border-border font-medium" 
                      : "bg-background/50 border-transparent text-muted-foreground"
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="truncate pr-2 font-semibold text-sm">
                    {reply.leads?.full_name || reply.from_email}
                  </span>
                  <span className="text-xs whitespace-nowrap">
                    {formatDistance(reply.received_at)}
                  </span>
                </div>
                <div className="text-xs mb-2 text-muted-foreground truncate">
                  {reply.leads?.company_name || "Unknown Company"}
                </div>
                <div className="text-sm truncate mb-2">
                  {reply.subject}
                </div>
                <div className="flex gap-2">
                  {reply.is_interested && (
                    <Badge variant="default" className="text-[10px] h-4 px-1 py-0">Interested</Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 truncate max-w-[120px]">
                    {reply.campaigns?.name}
                  </Badge>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Content Pane */}
      <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
        {selectedReply ? (
          <>
            {/* Header / Actions */}
            <div className="p-4 border-b flex justify-between items-center bg-background shrink-0">
              <div className="flex flex-col">
                <h3 className="text-lg font-semibold">{selectedReply.subject}</h3>
                <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  <User className="h-3 w-3" />
                  {selectedReply.leads?.full_name} ({selectedReply.from_email})
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant={selectedReply.is_interested ? "default" : "outline"} onClick={handleToggleInterested}>
                  <Star className="h-4 w-4 mr-2" />
                  {selectedReply.is_interested ? "Interested" : "Mark Interested"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleCopyEmail}>
                  <Copy className="h-4 w-4 mr-2" /> Copy Email
                </Button>
                {selectedReply.campaigns?.booking_url && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={selectedReply.campaigns.booking_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" /> Book Consultation
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={handleStopCampaign}>
                  <XCircle className="h-4 w-4 mr-2" /> Stop Campaign
                </Button>
              </div>
            </div>

            {/* Conversation Thread */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
              
              {/* Outbound Message */}
              {selectedReply.campaign_recipients && (
                <div className="flex flex-col max-w-3xl mr-12 space-y-2">
                  <div className="text-xs text-muted-foreground pl-2 flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Sent via {selectedReply.campaigns?.name} • {selectedReply.campaign_recipients.sent_at ? formatDate(selectedReply.campaign_recipients.sent_at) : "Unknown time"}
                  </div>
                  <Card className="p-4 bg-white border-slate-200">
                    <div className="font-medium text-sm mb-2 pb-2 border-b">
                      Subject: {selectedReply.campaign_recipients.rendered_subject}
                    </div>
                    <div 
                      className="text-sm prose prose-sm max-w-none whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: selectedReply.campaign_recipients.rendered_body || "" }}
                    />
                  </Card>
                </div>
              )}

              {/* Inbound Reply */}
              <div className="flex flex-col max-w-3xl ml-12 space-y-2">
                <div className="text-xs text-muted-foreground pr-2 flex items-center gap-2 justify-end">
                  <Mail className="h-3 w-3" />
                  Reply received • {formatDate(selectedReply.received_at)}
                </div>
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <div className="font-medium text-sm mb-2 pb-2 border-b border-primary/10">
                    From: {selectedReply.from_email}
                  </div>
                  <div className="text-sm whitespace-pre-wrap font-mono">
                    {selectedReply.body}
                  </div>
                </Card>
              </div>

            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground h-full flex-col gap-4">
            <Mail className="h-12 w-12 opacity-20" />
            <p>Select a conversation to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
