"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Upload, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  FileSpreadsheet, 
  RefreshCw, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Send
} from "lucide-react";
import { processRawInputImport } from "../actions";
import { ImportStats, LeadValidationError } from "@/lib/leads/lead-types";

export function ImportClient() {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "processing" | "summary">("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("Analyzing data with Gemini AI...");
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [validationErrors, setValidationErrors] = useState<LeadValidationError[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [rawText, setRawText] = useState("");
  const [currentFileName, setCurrentFileName] = useState("Uploaded_Leads.csv");

  const startImportPipeline = async (textData: string, sourceName: string) => {
    if (!textData || !textData.trim()) {
      alert("Please provide a valid CSV file, Markdown table, or contact text.");
      return;
    }

    setCurrentFileName(sourceName);
    setIsProcessing(true);
    setStep("processing");
    setProcessingStatus("✨ Gemini AI is analyzing, refining & verifying lead structure...");

    try {
      const result = await processRawInputImport(textData, sourceName);

      if (!result.success) {
        throw new Error(result.error || "Failed to process lead import.");
      }

      setStats(result.stats);
      setValidationErrors(result.errors || []);
      setStep("summary");
    } catch (error) {
      console.error("[Lead Import Failed]", error);
      alert(`Import Error: ${error instanceof Error ? error.message : "Unexpected error during import"}`);
      setStep("upload");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size === 0) {
      alert("The selected file is empty (0 bytes). Please upload a file with lead records.");
      e.target.value = "";
      return;
    }

    const fileContent = await selectedFile.text();
    startImportPipeline(fileContent, selectedFile.name);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (droppedFile.size === 0) {
        alert("The dropped file is empty (0 bytes).");
        return;
      }
      const fileContent = await droppedFile.text();
      startImportPipeline(fileContent, droppedFile.name);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  if (step === "upload") {
    return (
      <div className="space-y-6">
        {/* Banner */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-100 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-purple-950">AI-Powered Automatic Lead Refinement</h4>
            <p className="text-xs text-purple-700 mt-0.5">
              Upload CSV, TSV, Markdown tables, JSON, or unformatted text. Gemini AI automatically structures, normalizes names & companies, validates emails, and deduplicates records.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* File Dropzone Card */}
          <label
            htmlFor="csv-file-upload-input"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`block cursor-pointer transition-all duration-200 ${
              isDragging ? "ring-2 ring-purple-500 scale-[1.01]" : ""
            }`}
          >
            <Card className={`border-dashed bg-gray-50/50 hover:bg-purple-50/30 transition-colors h-full flex flex-col justify-between ${
              isDragging ? "border-purple-500 bg-purple-50/50" : ""
            }`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSpreadsheet className="w-5 h-5 text-purple-600" />
                  Upload File (CSV, TSV, TXT, JSON, MD)
                </CardTitle>
                <CardDescription>Drag and drop or click anywhere to select your leads file.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <div className="rounded-full bg-purple-100 p-4 mb-4 text-purple-600 shadow-inner">
                  <Upload className="h-8 w-8" />
                </div>
                <input
                  id="csv-file-upload-input"
                  type="file"
                  accept=".csv,.tsv,.txt,.json,.md,text/csv,text/plain,application/json"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
                <span className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors bg-purple-600 text-white hover:bg-purple-700 h-10 px-5 py-2 pointer-events-none shadow-sm">
                  Select File from Computer
                </span>
                <p className="text-xs text-muted-foreground mt-3">
                  Click anywhere in this box or drag your file here
                </p>
              </CardContent>
            </Card>
          </label>

          {/* Paste Text Card */}
          <Card className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Paste Text / Markdown / Raw Data
              </CardTitle>
              <CardDescription>Paste raw contacts, ChatGPT tables, or messy contact text.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea 
                placeholder="Paste CSV data, Markdown table, JSON, or unformatted contacts here..." 
                className="w-full min-h-[140px] font-mono text-sm p-3 border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                disabled={isProcessing}
              />
              <Button 
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-sm font-medium" 
                onClick={() => startImportPipeline(rawText, "Pasted_Leads.csv")} 
                disabled={!rawText.trim() || isProcessing}
              >
                <Sparkles className="mr-2 w-4 h-4" />
                Refine & Auto-Import with Gemini AI
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <Card className="border-purple-100 shadow-md">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 animate-pulse">
              <Sparkles className="w-8 h-8 animate-spin" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Gemini AI Auto-Refining Leads</h3>
          <p className="text-sm text-purple-600 font-medium max-w-md animate-pulse mb-1">
            {processingStatus}
          </p>
          <p className="text-xs text-gray-400">
            Source: {currentFileName}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="pb-0 overflow-hidden flex flex-col border-green-100 shadow-sm">
      <CardHeader className="bg-green-50/40 border-b border-green-100/60">
        <CardTitle className="flex items-center gap-2 text-green-900">
          <CheckCircle2 className="text-green-600 w-6 h-6" />
          Lead Ingestion & AI Refinement Complete!
        </CardTitle>
        <CardDescription className="text-green-700">
          Gemini AI refined, verified, and deduplicated your leads. All valid records are now campaign-ready.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 border rounded-xl bg-gray-50/80">
            <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Total Processed</div>
            <div className="text-2xl font-bold text-gray-800">{stats?.totalRows || 0}</div>
          </div>
          <div className="p-4 border border-green-200 rounded-xl bg-green-50/70">
            <div className="text-xs font-medium text-green-600 mb-1 uppercase tracking-wide">Newly Added</div>
            <div className="text-2xl font-bold text-green-700">
              {stats?.importedRows || 0}
            </div>
          </div>
          <div className="p-4 border border-orange-200 rounded-xl bg-orange-50/70">
            <div className="text-xs font-medium text-orange-600 mb-1 uppercase tracking-wide">Duplicates Skipped</div>
            <div className="text-2xl font-bold text-orange-700">
              {stats?.duplicateRows || 0}
            </div>
          </div>
          <div className="p-4 border border-red-200 rounded-xl bg-red-50/70">
            <div className="text-xs font-medium text-red-600 mb-1 uppercase tracking-wide">Invalid / Rejected</div>
            <div className="text-2xl font-bold text-red-700">
              {stats?.invalidRows || 0}
            </div>
          </div>
        </div>

        {/* Validation Errors Drawer (if any) */}
        {validationErrors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
            <button
              onClick={() => setShowErrors((prev) => !prev)}
              className="flex items-center justify-between w-full text-left font-medium text-sm text-red-900"
            >
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                {validationErrors.length} rows had validation or format issues (click to inspect)
              </span>
              {showErrors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showErrors && (
              <div className="mt-3 max-h-48 overflow-y-auto space-y-1.5 text-xs text-red-800">
                {validationErrors.map((err, idx) => (
                  <div key={idx} className="p-2 rounded bg-white/80 border border-red-100 flex justify-between">
                    <span>
                      <strong>Row {err.row}:</strong> {err.reason}
                    </span>
                    {err.email && <span className="font-mono text-gray-500">{err.email}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t bg-gray-50/80 p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
        <Button variant="outline" onClick={() => setStep("upload")} className="w-full sm:w-auto gap-2">
          <RefreshCw className="w-4 h-4" /> Import Another Batch
        </Button>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button 
            variant="secondary"
            onClick={() => router.push("/dashboard/leads")}
            className="w-full sm:w-auto gap-2"
          >
            View Leads Table <ArrowRight className="w-4 h-4" />
          </Button>
          <Button 
            onClick={() => router.push("/dashboard/campaigns/new")}
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white gap-2 shadow-sm"
          >
            <Send className="w-4 h-4" /> Create Campaign
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
