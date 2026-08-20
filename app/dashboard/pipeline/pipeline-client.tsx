"use client";

import { useState } from "react";
import { updateLeadStatus, createMeeting } from "./actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Calendar, Building } from "lucide-react";

type Lead = {
  id: string;
  full_name: string;
  email: string;
  company_name: string;
  status: string;
};

const STAGES = [
  { id: "new", label: "New", color: "bg-gray-100" },
  { id: "contacted", label: "Contacted", color: "bg-blue-100" },
  { id: "replied", label: "Replied", color: "bg-purple-100" },
  { id: "interested", label: "Interested", color: "bg-orange-100" },
  { id: "meeting", label: "Meeting", color: "bg-indigo-100" },
  { id: "won", label: "Won", color: "bg-green-100" },
  { id: "lost", label: "Lost", color: "bg-red-100" },
];

export function PipelineClient({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("leadId", leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    const leadId = e.dataTransfer.getData("leadId");
    if (!leadId) return;

    // Optimistic update
    setLeads((current) =>
      current.map((l) => (l.id === leadId ? { ...l, status: targetStatus } : l))
    );

    try {
      await updateLeadStatus(leadId, targetStatus);
    } catch (err) {
      console.error(err);
      // Revert if failed
      setLeads([...initialLeads]);
    }
  };

  const openMeetingModal = (lead: Lead) => {
    setSelectedLead(lead);
    setMeetingDate("");
    setMeetingNotes("");
    setMeetingModalOpen(true);
  };

  const handleCreateMeeting = async () => {
    if (!selectedLead || !meetingDate) return;
    try {
      await createMeeting(selectedLead.id, null, new Date(meetingDate).toISOString(), meetingNotes);
      setLeads((current) =>
        current.map((l) => (l.id === selectedLead.id ? { ...l, status: "meeting" } : l))
      );
      setMeetingModalOpen(false);
      alert("Meeting scheduled!");
    } catch (err) {
      console.error(err);
      alert("Failed to schedule meeting");
    }
  };

  return (
    <div className="flex h-full gap-4 overflow-x-auto pb-4 items-stretch">
      {STAGES.map((stage) => {
        const stageLeads = leads.filter((l) => (l.status || "new") === stage.id);
        
        return (
          <div
            key={stage.id}
            className="flex-shrink-0 w-80 bg-gray-50/50 rounded-xl border flex flex-col"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            <div className={`p-3 border-b flex justify-between items-center ${stage.color} rounded-t-xl bg-opacity-50`}>
              <h3 className="font-semibold text-sm">{stage.label}</h3>
              <Badge variant="secondary" className="bg-white/50">{stageLeads.length}</Badge>
            </div>
            
            <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[150px]">
              {stageLeads.map((lead) => (
                <Card
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  className="p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow bg-white"
                >
                  <div className="font-medium text-sm mb-1">{lead.full_name || lead.email}</div>
                  {lead.full_name && (
                    <div className="text-xs text-muted-foreground truncate mb-2">{lead.email}</div>
                  )}
                  {lead.company_name && (
                    <div className="flex items-center text-xs text-muted-foreground mb-3">
                      <Building className="w-3 h-3 mr-1" />
                      <span className="truncate">{lead.company_name}</span>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-xs px-2 w-full"
                      onClick={() => openMeetingModal(lead)}
                    >
                      <Calendar className="w-3 h-3 mr-1" /> Schedule
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {/* Meeting Modal */}
      <Dialog open={meetingModalOpen} onOpenChange={setMeetingModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Meeting</DialogTitle>
            <DialogDescription>
              Record a meeting with {selectedLead?.full_name || selectedLead?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date & Time</Label>
              <Input 
                type="datetime-local" 
                value={meetingDate} 
                onChange={(e) => setMeetingDate(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input 
                placeholder="Zoom link, agenda..." 
                value={meetingNotes} 
                onChange={(e) => setMeetingNotes(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMeetingModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateMeeting} disabled={!meetingDate}>
              Save Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
