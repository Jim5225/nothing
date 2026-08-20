"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Trash2, Loader2 } from "lucide-react";
import { deleteAllLeads, deleteSelectedLeads } from "./actions";

interface Lead {
  id: string;
  email: string;
  full_name?: string;
  job_title?: string;
  company_name?: string;
  source?: string;
  created_at: string;
}

interface LeadsClientProps {
  initialLeads: Lead[];
  totalCount: number;
  currentPage: number;
  searchQuery: string;
}

export function LeadsClient({
  initialLeads,
  totalCount,
  currentPage,
  searchQuery,
}: LeadsClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(searchQuery);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/dashboard/leads?search=${encodeURIComponent(searchTerm)}`);
  };

  const totalPages = Math.ceil(totalCount / 20);

  const toggleSelectAll = () => {
    if (selectedLeads.length === initialLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(initialLeads.map((l) => l.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedLeads((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedLeads.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to delete ${selectedLeads.length} selected lead(s)?`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteSelectedLeads(selectedLeads);
      setSelectedLeads([]);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to delete selected leads.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (totalCount === 0) {
      alert("There are no leads in the database to delete.");
      return;
    }

    const confirmFirst = confirm(
      `⚠️ WARNING: Are you sure you want to DELETE ALL ${totalCount} leads from your database? This will permanently remove all leads and free up your Supabase database storage.`
    );
    if (!confirmFirst) return;

    const confirmSecond = confirm(
      `Please confirm one more time: Do you really want to PURGE ALL ${totalCount} leads? This action cannot be undone.`
    );
    if (!confirmSecond) return;

    setIsDeleting(true);
    try {
      await deleteAllLeads();
      setSelectedLeads([]);
      router.refresh();
      alert("All leads have been deleted successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to delete all leads.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 border border-slate-200/80 rounded-xl shadow-xs">
        <form onSubmit={handleSearch} className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="search"
            placeholder="Search by name, email, company..."
            className="pl-9 bg-slate-50/70 border-slate-200 focus:bg-white transition-all text-sm rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </form>

        <div className="flex items-center gap-2.5">
          {selectedLeads.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white font-medium shadow-xs"
            >
              {isDeleting ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              )}
              Delete Selected ({selectedLeads.length})
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleDeleteAll}
            disabled={isDeleting || totalCount === 0}
            className="bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-semibold shadow-sm shadow-rose-500/20 border-0 transition-all"
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5 mr-1.5 text-white/90" />
            )}
            Clear All Leads ({totalCount})
          </Button>
        </div>
      </div>

      <div className="border border-slate-200/90 rounded-xl bg-white overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="w-12 text-center">
                <Checkbox
                  checked={
                    initialLeads.length > 0 &&
                    selectedLeads.length === initialLeads.length
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="font-semibold text-slate-700">Name</TableHead>
              <TableHead className="font-semibold text-slate-700">Email</TableHead>
              <TableHead className="font-semibold text-slate-700">Job Title</TableHead>
              <TableHead className="font-semibold text-slate-700">Company</TableHead>
              <TableHead className="font-semibold text-slate-700">Source</TableHead>
              <TableHead className="font-semibold text-slate-700">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                  <div className="max-w-xs mx-auto space-y-1">
                    <p className="font-medium text-slate-700">No leads in database</p>
                    <p className="text-xs text-slate-400">Import a CSV, Excel, or Markdown file to populate your list.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              initialLeads.map((lead) => (
                <TableRow key={lead.id} className="hover:bg-slate-50/60 transition-colors">
                  <TableCell className="text-center">
                    <Checkbox
                      checked={selectedLeads.includes(lead.id)}
                      onCheckedChange={() => toggleSelect(lead.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-slate-900 max-w-[150px] truncate" title={lead.full_name || ""}>
                    {lead.full_name || "-"}
                  </TableCell>
                  <TableCell className="text-indigo-600 font-medium max-w-[200px] truncate" title={lead.email}>
                    {lead.email}
                  </TableCell>
                  <TableCell className="text-slate-600 max-w-[150px] truncate" title={lead.job_title || ""}>
                    {lead.job_title || "-"}
                  </TableCell>
                  <TableCell className="text-slate-700 font-medium max-w-[150px] truncate" title={lead.company_name || ""}>
                    {lead.company_name || "-"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      {lead.source || "Manual"}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500 font-medium">
            Showing {(currentPage - 1) * 20 + 1} to{" "}
            {Math.min(currentPage * 20, totalCount)} of {totalCount} leads
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              className="bg-white hover:bg-slate-50 text-xs font-medium"
              onClick={() =>
                router.push(
                  `/dashboard/leads?page=${currentPage - 1}&search=${searchTerm}`
                )
              }
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              className="bg-white hover:bg-slate-50 text-xs font-medium"
              onClick={() =>
                router.push(
                  `/dashboard/leads?page=${currentPage + 1}&search=${searchTerm}`
                )
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
