"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Mail, Trash2, CheckCircle2, RefreshCw } from "lucide-react";
import { generateSnapshots, removeRecipient, updateCampaignSender, sendTestEmail, approveCampaign } from "./actions";

interface ReviewClientProps {
  campaign: Record<string, unknown> & { id: string, name: string, status: string, email_account_id?: string, booking_url?: string };
  recipients: Array<Record<string, unknown> & { id: string, rendered_subject?: string, rendered_body?: string, leads?: Record<string, unknown> & { email?: string, full_name?: string, company_name?: string } }>;
  emailAccounts: Array<{ id: string, email_address: string }>;
}

export function ReviewClient({ campaign, recipients, emailAccounts }: ReviewClientProps) {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  const [approveOpen, setApproveOpen] = useState(false);

  const handleRegenerate = async () => {
    if (!confirm("This will overwrite any manual edits made to subject/body. Continue?")) return;
    setIsGenerating(true);
    try {
      const result = await generateSnapshots(campaign.id);
      if (result && !result.success) {
        alert("Failed to regenerate: " + result.error);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to regenerate");
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto-generate snapshots if missing
  useEffect(() => {
    const missing = recipients.some((r) => !r.rendered_subject);
    if (missing && campaign.status !== "approved" && campaign.status !== "sending") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsGenerating(true);
      generateSnapshots(campaign.id).catch(console.error).finally(() => setIsGenerating(false));
    }
  }, [recipients, campaign.status, campaign.id]);
  const handleSenderChange = async (accountId: string) => {
    try {
      await updateCampaignSender(campaign.id, accountId);
    } catch (error) {
      console.error("Failed to update sender", error);
    }
  };

  const handleRemoveRecipient = async (recipientId: string) => {
    try {
      const result = await removeRecipient(recipientId, campaign.id);
      if (result && !result.success) {
        alert("Failed to remove: " + result.error);
        return;
      }
      if (selectedIndex >= recipients.length - 1) {
        setSelectedIndex(Math.max(0, recipients.length - 2));
      }
    } catch (error) {
      console.error("Failed to remove", error);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) return;
    setIsTesting(true);
    try {
      const result = await sendTestEmail(campaign.id, testEmail);
      if (!result.success) {
        alert(`Test failed: ${result.error}`);
      } else {
        alert("Test email sent!");
        setTestEmailOpen(false);
      }
    } catch (error: unknown) {
      alert(`Test failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const result = await approveCampaign(campaign.id);
      if (!result.success) {
        alert(`Approval failed: ${result.error}`);
      } else {
        alert("Campaign approved successfully!");
        setApproveOpen(false);
        router.push("/dashboard/campaigns");
      }
    } catch (error: unknown) {
      alert(`Approval failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsApproving(false);
    }
  };

  const filteredRecipients = recipients.filter((r) => {
    const term = search.toLowerCase();
    return (
      (r.leads?.full_name || "").toLowerCase().includes(term) ||
      (r.leads?.email || "").toLowerCase().includes(term) ||
      (r.leads?.company_name || "").toLowerCase().includes(term)
    );
  });

  const selectedRecipient = filteredRecipients[selectedIndex];
  const isApproved = campaign.status === "approved" || campaign.status === "sending";

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top Bar: Sender Selection and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg border">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <Label className="whitespace-nowrap font-semibold">Gmail Sender:</Label>
          <Select 
            value={campaign.email_account_id || ""} 
            onValueChange={handleSenderChange}
            disabled={isApproved || emailAccounts.length === 0}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder={emailAccounts.length === 0 ? "No Gmail accounts connected" : "Select Gmail Account"} />
            </SelectTrigger>
            <SelectContent>
              {emailAccounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.email_address}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => handleRegenerate()}
            disabled={isGenerating || isApproved}
            className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-medium shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 mr-2 text-slate-500 ${isGenerating ? "animate-spin" : ""}`} />
            Regenerate Previews
          </Button>
          <Button
            variant="secondary"
            onClick={() => setTestEmailOpen(true)}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold shadow-xs"
          >
            <Mail className="w-4 h-4 mr-2 text-indigo-600" />
            Send Test
          </Button>
          <Button 
            onClick={() => setApproveOpen(true)} 
            disabled={isApproved || !campaign.email_account_id || recipients.length === 0 || isGenerating}
            className="bg-gradient-to-r from-emerald-500 via-teal-600 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold shadow-md shadow-emerald-500/25 border-0 transition-all scale-100 hover:scale-[1.02]"
          >
            <CheckCircle2 className="w-4 h-4 mr-2 text-white" />
            Approve & Send
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden min-h-[500px]">
        {/* Left Sidebar - Recipients List */}
        <Card className="w-full md:w-1/3 flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Recipients</h3>
              <Badge variant="secondary">{filteredRecipients.length} / {recipients.length}</Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search recipients..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedIndex(0);
                }}
                className="pl-9 bg-white"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="divide-y">
              {filteredRecipients.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">No recipients found</div>
              ) : (
                filteredRecipients.map((rec, idx) => (
                  <div
                    key={rec.id}
                    className={`w-full text-left p-3 hover:bg-gray-50 transition-colors flex items-center justify-between group ${
                      selectedIndex === idx ? "bg-blue-50 border-l-2 border-blue-600" : ""
                    }`}
                  >
                    <button
                      className="flex-1 text-left overflow-hidden pr-2"
                      onClick={() => setSelectedIndex(idx)}
                    >
                      <div className="font-medium truncate text-sm">
                        {rec.leads?.full_name || rec.leads?.email}
                      </div>
                      {rec.leads?.full_name && (
                        <div className="text-xs text-gray-500 truncate">{rec.leads?.email}</div>
                      )}
                      {rec.leads?.company_name && (
                        <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                          {rec.leads?.company_name}
                        </div>
                      )}
                    </button>
                    {!isApproved && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveRecipient(rec.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Right Content - Rendered Email Preview */}
        <Card className="w-full md:w-2/3 flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between shrink-0">
            <h3 className="font-semibold">Rendered Preview</h3>
            {isApproved && <Badge className="bg-green-100 text-green-800">Snapshot Frozen</Badge>}
          </div>
          
          {selectedRecipient ? (
            <div className="flex-1 overflow-y-auto p-6 bg-white flex flex-col gap-6">
              {!selectedRecipient.rendered_subject ? (
                <div className="flex items-center justify-center h-full text-gray-500 flex-col gap-3">
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 h-8 w-8"></div>
                      Generating preview...
                    </>
                  ) : (
                    "Preview not generated. Click Regenerate Previews."
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="flex justify-between border-b pb-4">
                      <div className="text-sm text-gray-500 w-20 shrink-0">To:</div>
                      <div className="font-medium flex-1">
                        {selectedRecipient.leads?.full_name ? `${selectedRecipient.leads?.full_name} <${selectedRecipient.leads?.email}>` : selectedRecipient.leads?.email}
                      </div>
                    </div>
                    <div className="flex justify-between border-b pb-4">
                      <div className="text-sm text-gray-500 w-20 shrink-0">Subject:</div>
                      <div className="font-medium flex-1">{selectedRecipient.rendered_subject}</div>
                    </div>
                  </div>
                  
                  <div className="flex-1 mt-4">
                    <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap font-sans">
                      {selectedRecipient.rendered_body}
                    </div>
                    {campaign.booking_url && (
                      <div className="mt-8 pt-4 border-t border-gray-100 flex justify-center">
                        <Button asChild>
                          <a href={campaign.booking_url} target="_blank" rel="noreferrer">
                            View Booking Calendar
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a recipient to preview
            </div>
          )}
        </Card>
      </div>

      {/* Test Email Modal */}
      <Dialog open={testEmailOpen} onOpenChange={setTestEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Send a test preview to yourself. This uses generic fallback variables (e.g. &quot;Test Company&quot;) and won&apos;t affect campaign analytics.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Test Email Address</Label>
              <Input 
                type="email" 
                placeholder="you@example.com" 
                value={testEmail} 
                onChange={(e) => setTestEmail(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestEmailOpen(false)}>Cancel</Button>
            <Button onClick={handleSendTest} disabled={isTesting || !testEmail}>
              {isTesting ? "Sending..." : "Send Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Modal */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Campaign</DialogTitle>
            <DialogDescription>
              You are about to authorize this campaign for sending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 text-blue-900 p-4 rounded-md text-sm border border-blue-100">
              <p><strong>Confirm Action:</strong></p>
              <p className="mt-1">You are about to queue <strong>{recipients.length}</strong> emails from your connected Gmail account.</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Campaign: {campaign.name}</li>
                <li>Sender: {emailAccounts.find(a => a.id === campaign.email_account_id)?.email_address || "None"}</li>
                <li>Excluded/Suppressed: Will be automatically filtered during approval.</li>
              </ul>
            </div>
            <p className="text-sm text-gray-600">
              Once approved, rendered templates are frozen and cannot be changed. The system will begin queuing emails for delivery in the background.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={isApproving} className="bg-green-600 hover:bg-green-700">
              {isApproving ? "Approving..." : "Confirm & Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
