"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, ArrowRight, CheckCircle2, Sparkles, Loader2, FileSpreadsheet, RefreshCw } from "lucide-react";
import { processLeadImport } from "../actions";
import { extractLeadsWithAI } from "./ai-actions";

interface ImportStats {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  failedRows: number;
}

export function ImportClient() {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "processing" | "summary">("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("Analyzing data with Gemini AI...");
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [rawText, setRawText] = useState("");
  const [currentFileName, setCurrentFileName] = useState("Uploaded_Leads.csv");

  const runAIExtractionAndImport = async (textData: string, sourceName: string) => {
    if (!textData.trim()) {
      alert("Please provide valid CSV data or text.");
      return;
    }

    setCurrentFileName(sourceName);
    setIsProcessing(true);
    setStep("processing");
    setProcessingStatus("✨ Gemini AI is analyzing, refining & verifying your leads...");

    try {
      const aiResult = await extractLeadsWithAI(textData);

      if (!aiResult.success || !aiResult.data || aiResult.data.length === 0) {
        throw new Error(aiResult.error || "No valid leads found in the data.");
      }

      setProcessingStatus(`Saving ${aiResult.data.length} verified leads to your database...`);

      const importResult = await processLeadImport(
        sourceName,
        aiResult.data.length,
        aiResult.data
      );

      setStats(importResult.stats);
      setStep("summary");
    } catch (error) {
      console.error("[Auto Import Error]", error);
      alert(`Import Failed: ${error instanceof Error ? error.message : "Unknown error occurred"}`);
      setStep("upload");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileContent = await selectedFile.text();
    runAIExtractionAndImport(fileContent, selectedFile.name);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      const fileContent = await droppedFile.text();
      runAIExtractionAndImport(fileContent, droppedFile.name);
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
        <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-100 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-600 text-white shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-purple-900">AI-Powered Automatic Lead Import</h4>
            <p className="text-xs text-purple-700">
              Upload any CSV file or paste messy text. Gemini AI automatically cleans, verifies, standardizes names and companies, and saves them directly to your leads!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CSV Upload Card */}
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
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-purple-600" />
                  Upload CSV File
                </CardTitle>
                <CardDescription>Drag and drop or click to upload any CSV file.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <div className="rounded-full bg-purple-100 p-4 mb-4 text-purple-600">
                  <Upload className="h-8 w-8" />
                </div>
                <input
                  id="csv-file-upload-input"
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
                <span className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors bg-purple-600 text-white hover:bg-purple-700 h-10 px-5 py-2 pointer-events-none shadow-sm">
                  Select CSV File
                </span>
                <p className="text-xs text-muted-foreground mt-3">
                  Click anywhere in this box or drag your .csv file here
                </p>
              </CardContent>
            </Card>
          </label>

          {/* Raw Text / Markdown Card */}
          <Card className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Paste Text / Markdown Table
              </CardTitle>
              <CardDescription>Paste raw contacts, ChatGPT tables, or messy lists.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea 
                placeholder="Paste CSV rows, ChatGPT table, or unformatted contact text here..." 
                className="w-full min-h-[140px] font-mono text-sm p-3 border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                disabled={isProcessing}
              />
              <Button 
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-sm" 
                onClick={() => runAIExtractionAndImport(rawText, "Pasted_Leads.csv")} 
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
          AI Import Complete!
        </CardTitle>
        <CardDescription className="text-green-700">
          Gemini AI has successfully refined, verified, and saved your leads into the database.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 border rounded-xl bg-gray-50/80">
            <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Total Processed</div>
            <div className="text-2xl font-bold text-gray-800">{stats?.totalRows || 0}</div>
          </div>
          <div className="p-4 border border-green-200 rounded-xl bg-green-50/70">
            <div className="text-xs font-medium text-green-600 mb-1 uppercase tracking-wide">Successfully Imported</div>
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
      </CardContent>
      <CardFooter className="border-t bg-gray-50/80 p-4 flex justify-between items-center">
        <Button variant="outline" onClick={() => setStep("upload")} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Import More Leads
        </Button>
        <Button 
          onClick={() => router.push("/dashboard/leads")}
          className="bg-green-600 hover:bg-green-700 text-white gap-2 shadow-sm"
        >
          View All Leads <ArrowRight className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
