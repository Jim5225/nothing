"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { createCampaignDraft } from "../actions";
import { SUPPORTED_VARIABLES } from "@/lib/template-renderer";

interface Lead {
  id: string;
  email: string;
  full_name?: string;
  company_name?: string;
}

export function CampaignEditor({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [senderName, setSenderName] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (variable: string) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textToInsert = `{{${variable}}}`;
    
    const newBody = body.substring(0, start) + textToInsert + body.substring(end);
    setBody(newBody);
    
    // Attempt to restore focus/cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 0);
  };

  const toggleAllLeads = () => {
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads.map((l) => l.id));
    }
  };

  const toggleLead = (id: string) => {
    setSelectedLeads((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!name || selectedLeads.length === 0 || !subject || !body) {
      alert("Please fill in all required fields (Name, Subject, Body, and at least 1 Lead).");
      return;
    }

    setIsSaving(true);
    try {
      const campaignId = await createCampaignDraft({
        name,
        subject,
        body,
        booking_url: bookingUrl,
        sender_name: senderName,
        leadIds: selectedLeads,
      });
      router.push(`/dashboard/campaigns/${campaignId}`);
    } catch (error) {
      console.error(error);
      alert("Failed to create campaign draft.");
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name <span className="text-red-500">*</span></Label>
              <Input
                id="name"
                placeholder="e.g. Q3 Outreach"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="senderName">Sender Name</Label>
                <Input
                  id="senderName"
                  placeholder="e.g. Jim"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bookingUrl">Booking URL</Label>
                <Input
                  id="bookingUrl"
                  placeholder="e.g. https://cal.com/jim"
                  value={bookingUrl}
                  onChange={(e) => setBookingUrl(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Template</CardTitle>
            <CardDescription>Use variables to personalize your outreach.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject <span className="text-red-500">*</span></Label>
              <Input
                id="subject"
                placeholder="Quick question regarding {{company_name}}"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="body">Email Body <span className="text-red-500">*</span></Label>
                <span className="text-xs text-gray-500">{body.length} chars</span>
              </div>
              <div className="border rounded-md overflow-hidden flex flex-col">
                <div className="bg-gray-50 border-b px-3 py-2 flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-medium text-gray-500 mr-2">Insert:</span>
                  {SUPPORTED_VARIABLES.map((v) => (
                    <Badge 
                      key={v} 
                      variant="outline" 
                      className="cursor-pointer hover:bg-gray-200 transition-colors bg-white font-mono text-[10px]"
                      onClick={() => insertVariable(v)}
                    >
                      {v}
                    </Badge>
                  ))}
                </div>
                <textarea
                  id="body"
                  ref={textareaRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Hi {{first_name}},&#10;&#10;I noticed you're at {{company_name}}..."
                  className="min-h-[300px] w-full p-4 focus:outline-none resize-y"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="flex flex-col h-full max-h-[800px]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recipients <span className="text-red-500">*</span></CardTitle>
              <Badge variant="secondary">{selectedLeads.length} selected</Badge>
            </div>
            <CardDescription>Select leads to include in this campaign.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pr-2 space-y-2">
            {leads.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No leads found in workspace. Import some leads first.</p>
            ) : (
              <div className="border rounded-md divide-y">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 sticky top-0">
                  <Checkbox 
                    id="selectAll" 
                    checked={selectedLeads.length > 0 && selectedLeads.length === leads.length}
                    onCheckedChange={toggleAllLeads}
                  />
                  <Label htmlFor="selectAll" className="font-medium cursor-pointer">
                    Select All ({leads.length})
                  </Label>
                </div>
                {leads.map((lead) => (
                  <div key={lead.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50">
                    <Checkbox 
                      id={`lead-${lead.id}`} 
                      checked={selectedLeads.includes(lead.id)}
                      onCheckedChange={() => toggleLead(lead.id)}
                    />
                    <div className="grid gap-1.5 leading-none cursor-pointer flex-1" onClick={() => toggleLead(lead.id)}>
                      <Label htmlFor={`lead-${lead.id}`} className="font-medium cursor-pointer">
                        {lead.full_name || lead.email}
                      </Label>
                      {lead.full_name && <p className="text-xs text-gray-500">{lead.email}</p>}
                      {lead.company_name && <p className="text-[10px] text-gray-400">{lead.company_name}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <div className="p-4 border-t bg-gray-50 mt-auto">
            <Button 
              className="w-full" 
              onClick={handleSave} 
              disabled={isSaving || !name || selectedLeads.length === 0 || !subject || !body}
            >
              {isSaving ? "Saving..." : "Save Draft & Preview"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
