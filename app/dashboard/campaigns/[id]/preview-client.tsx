"use client";

import { useState } from "react";
import { renderTemplate } from "@/lib/template-renderer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface CampaignPreviewClientProps {
  campaign: {
    id: string;
    name: string;
    status: string;
    booking_url?: string;
    sender_name?: string;
    email_templates?: {
      subject: string;
      body: string;
    };
  };
  recipients: Array<{
    id: string;
    leads: {
      id: string;
      email: string;
      first_name?: string;
      last_name?: string;
      full_name?: string;
      company_name?: string;
      job_title?: string;
      website_url?: string;
    };
  }>;
}

export function CampaignPreviewClient({ campaign, recipients }: CampaignPreviewClientProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedRecipient = recipients[selectedIndex];
  const template = campaign.email_templates;

  // Prepare variables for rendering
  const lead = selectedRecipient?.leads || {};
  const variables = {
    first_name: lead.first_name,
    last_name: lead.last_name,
    full_name: lead.full_name,
    company_name: lead.company_name,
    job_title: lead.job_title,
    website: lead.website_url,
    booking_link: campaign.booking_url,
    sender_name: campaign.sender_name,
    sender_email: "sender@example.com", // Stub for preview since we don't have Gmail accounts connected yet
  };

  const renderedSubject = template ? renderTemplate(template.subject, variables) : "";
  const renderedBody = template ? renderTemplate(template.body, variables) : "";

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full overflow-hidden">
      {/* Left Sidebar - Recipients List */}
      <Card className="w-full md:w-1/3 flex flex-col h-[600px]">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between shrink-0">
          <h3 className="font-semibold">Recipients</h3>
          <Badge variant="secondary">{recipients.length}</Badge>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y">
            {recipients.map((rec, idx) => (
              <button
                key={rec.id}
                onClick={() => setSelectedIndex(idx)}
                className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                  selectedIndex === idx ? "bg-blue-50 border-l-2 border-blue-600" : ""
                }`}
              >
                <div className="font-medium truncate">
                  {rec.leads.full_name || rec.leads.email}
                </div>
                {rec.leads.full_name && (
                  <div className="text-sm text-gray-500 truncate">{rec.leads.email}</div>
                )}
                {rec.leads.company_name && (
                  <div className="text-xs text-gray-400 mt-1 truncate">
                    {rec.leads.company_name}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Right Content - Rendered Email Preview */}
      <Card className="w-full md:w-2/3 flex flex-col h-[600px] overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between shrink-0">
          <h3 className="font-semibold">Email Preview</h3>
          <div className="text-sm text-gray-500">
            Recipient {selectedIndex + 1} of {recipients.length}
          </div>
        </div>
        
        {selectedRecipient ? (
          <div className="flex-1 overflow-y-auto p-6 bg-white flex flex-col gap-6">
            <div className="space-y-4">
              <div className="flex justify-between border-b pb-4">
                <div className="text-sm text-gray-500 w-20 shrink-0">To:</div>
                <div className="font-medium flex-1">
                  {selectedRecipient.leads.full_name ? `${selectedRecipient.leads.full_name} <${selectedRecipient.leads.email}>` : selectedRecipient.leads.email}
                </div>
              </div>
              <div className="flex justify-between border-b pb-4">
                <div className="text-sm text-gray-500 w-20 shrink-0">Subject:</div>
                <div className="font-medium flex-1">{renderedSubject}</div>
              </div>
            </div>
            
            <div className="flex-1 mt-4">
              <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap font-sans">
                {renderedBody}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a recipient to preview
          </div>
        )}
        
        <div className="p-4 border-t bg-gray-50 flex items-center justify-between shrink-0">
          <Button variant="outline" asChild>
            <Link href="/dashboard/campaigns">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Campaigns
            </Link>
          </Button>
          <Button disabled className="opacity-50" title="Approval system not yet implemented in Phase 3">
            Approve & Send
          </Button>
        </div>
      </Card>
    </div>
  );
}
