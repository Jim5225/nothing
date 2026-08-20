"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { RawLeadInput, LeadImportResult, NormalizedLead, LeadValidationError } from "@/lib/leads/lead-types";
import { normalizeLeadRecord } from "@/lib/leads/normalizer";
import { validateLead } from "@/lib/leads/validator";
import { deduplicateInBatch, mergeLeadRecords } from "@/lib/leads/deduplicator";
import { detectInputFormat } from "@/lib/leads/parser";
import { refineLeadInputWithAI } from "@/lib/leads/ai-refiner";

export async function getLeads(page = 1, limit = 50, search = "") {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("workspace_id", workspace.workspace_id)
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`
    );
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw error;

  return { data, count: count || 0 };
}

/**
 * Core Production Lead Ingestion & Normalization Engine
 */
export async function processLeadImport(
  filename: string,
  totalRows: number,
  rawData: RawLeadInput[]
): Promise<LeadImportResult> {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");
  const workspaceId = workspace.workspace_id;

  const supabase = await createClient();

  // 1. Create lead_imports record to track batch progress
  const { data: importRecord, error: importError } = await supabase
    .from("lead_imports")
    .insert({
      workspace_id: workspaceId,
      filename: filename || "Untitled_Import.csv",
      total_rows: totalRows || rawData.length,
      status: "processing",
    })
    .select()
    .single();

  if (importError) throw importError;

  const validationErrors: LeadValidationError[] = [];
  const validNormalizedLeads: NormalizedLead[] = [];
  let invalidRows = 0;
  let suppressedRows = 0;

  // 2. Fetch workspace suppression list to exclude unsubscribed/bounced contacts
  const { data: suppressionData } = await supabase
    .from("lead_suppression")
    .select("email")
    .eq("workspace_id", workspaceId);

  const suppressedSet = new Set<string>(
    (suppressionData || []).map((s) => s.email.trim().toLowerCase())
  );

  // 3. Row-by-row Normalization & Validation with safe error isolation
  rawData.forEach((row, index) => {
    try {
      if (!row || typeof row !== "object") {
        invalidRows++;
        validationErrors.push({
          row: index + 1,
          reason: "Malformed row object",
        });
        return;
      }

      const normalized = normalizeLeadRecord(row, workspaceId, "Import", importRecord.id);

      if (!normalized) {
        invalidRows++;
        validationErrors.push({
          row: index + 1,
          email: String(row.email || ""),
          reason: "Missing or invalid email address",
        });
        return;
      }

      const validation = validateLead(normalized);
      if (!validation.valid) {
        invalidRows++;
        validationErrors.push({
          row: index + 1,
          email: normalized.email,
          reason: validation.errors.join(", "),
        });
        return;
      }

      if (suppressedSet.has(normalized.normalized_email)) {
        suppressedRows++;
        validationErrors.push({
          row: index + 1,
          email: normalized.email,
          reason: "Email is on workspace suppression/do-not-contact list",
        });
        return;
      }

      validNormalizedLeads.push(normalized);
    } catch (rowErr) {
      invalidRows++;
      validationErrors.push({
        row: index + 1,
        reason: rowErr instanceof Error ? rowErr.message : "Unexpected parsing error",
      });
    }
  });

  // 4. In-Batch Deduplication (merge fields for duplicate emails in same batch)
  const { uniqueLeads, inBatchDuplicates } = deduplicateInBatch(validNormalizedLeads);

  let importedRows = 0;
  let duplicateRows = inBatchDuplicates;
  let failedRows = 0;

  // 5. Database Chunked Batch Insert with Safe Enrichment
  if (uniqueLeads.length > 0) {
    const CHUNK_SIZE = 500;
    for (let i = 0; i < uniqueLeads.length; i += CHUNK_SIZE) {
      const chunk = uniqueLeads.slice(i, i + CHUNK_SIZE);

      try {
        // Fetch existing leads for the chunk to perform safe in-memory enrichment
        const emailsInChunk = chunk.map(l => l.normalized_email);
        const { data: existingData, error: fetchError } = await supabase
          .from("leads")
          .select("*")
          .eq("workspace_id", workspaceId)
          .in("normalized_email", emailsInChunk);

        if (fetchError) {
          console.error("[Database Batch Fetch Error]", fetchError);
          failedRows += chunk.length;
          continue;
        }

        const existingLeadsMap = new Map((existingData || []).map((l: any) => [l.normalized_email, l]));
        
        // Merge incoming records with existing records (non-destructive enrichment)
        const enrichedChunk = chunk.map(incomingLead => {
          const existing = existingLeadsMap.get(incomingLead.normalized_email);
          if (existing) {
            // mergeLeadRecords prioritizes existing non-null fields over incoming
            return mergeLeadRecords(existing as unknown as NormalizedLead, incomingLead);
          }
          return incomingLead;
        });

        const { data: inserted, error: insertError } = await supabase
          .from("leads")
          .upsert(enrichedChunk, {
            onConflict: "workspace_id,normalized_email",
            ignoreDuplicates: false, // Update instead of ignore
          })
          .select("id, normalized_email");

        if (insertError) {
          console.error("[Database Batch Insert Error]", insertError);
          failedRows += chunk.length;
        } else {
          // Count newly imported vs updated duplicates
          const insertedCount = inserted?.length || 0;
          let newInserts = 0;
          let updatedDupes = 0;
          
          if (inserted) {
            for (const row of inserted) {
               if (existingLeadsMap.has(row.normalized_email)) {
                 updatedDupes++;
               } else {
                 newInserts++;
               }
            }
          }
          
          importedRows += newInserts;
          duplicateRows += updatedDupes;
        }
      } catch (chunkErr) {
        console.error("[Chunk Exception]", chunkErr);
        failedRows += chunk.length;
      }
    }
  }

  let finalStatus = "completed";
  if (failedRows > 0 && importedRows === 0 && duplicateRows === 0) {
    finalStatus = "failed";
  } else if (failedRows > 0) {
    finalStatus = "completed_with_errors";
  }

  // 6. Finalize lead_imports record
  await supabase
    .from("lead_imports")
    .update({
      total_rows: totalRows || rawData.length,
      valid_rows: validNormalizedLeads.length,
      invalid_rows: invalidRows,
      suppressed_rows: suppressedRows,
      duplicate_rows: duplicateRows,
      imported_rows: importedRows,
      failed_rows: failedRows,
      status: finalStatus,
      completed_at: new Date().toISOString(),
    })
    .eq("id", importRecord.id);

  // 7. Audit Logging
  try {
    const { logActivity } = await import("@/lib/activity");
    await logActivity("csv_import", {
      filename: filename || "Lead_Import",
      imported: importedRows,
      duplicates: duplicateRows,
      invalid: invalidRows,
    });
  } catch {
    // Non-blocking
  }

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard");

  return {
    success: true,
    importId: importRecord.id,
    stats: {
      totalRows: totalRows || rawData.length,
      validRows: validNormalizedLeads.length,
      invalidRows,
      duplicateRows,
      importedRows,
      failedRows,
    },
    errors: validationErrors.slice(0, 50), // Return sample of validation errors
  };
}

/**
 * High-level unified import action:
 * Accepts any raw text (CSV, Markdown, JSON, Unstructured), refines it with Gemini,
 * and saves into Supabase.
 */
export async function processRawInputImport(
  rawText: string,
  filename = "Direct_Import.csv"
): Promise<LeadImportResult> {
  if (!rawText || !rawText.trim()) {
    return {
      success: false,
      error: "Input data is empty.",
      stats: {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        suppressedRows: 0,
        duplicateRows: 0,
        importedRows: 0,
        failedRows: 0,
      },
    };
  }

  const format = detectInputFormat(rawText);
  const aiResult = await refineLeadInputWithAI(rawText, format);

  if (!aiResult.success || !aiResult.data || aiResult.data.length === 0) {
    return {
      success: false,
      error: aiResult.error || "No valid contact information could be extracted.",
      stats: {
        totalRows: 0,
        validRows: 0,
        invalidRows: 1,
        suppressedRows: 0,
        duplicateRows: 0,
        importedRows: 0,
        failedRows: 0,
      },
    };
  }

  return processLeadImport(filename, aiResult.data.length, aiResult.data);
}

export async function deleteSelectedLeads(leadIds: string[]) {
  if (!leadIds || leadIds.length === 0) return { success: true, count: 0 };

  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();

  const { error, count } = await supabase
    .from("leads")
    .delete({ count: "exact" })
    .in("id", leadIds)
    .eq("workspace_id", workspace.workspace_id);

  if (error) throw error;

  try {
    const { logActivity } = await import("@/lib/activity");
    await logActivity("leads_deleted", { count: count || leadIds.length });
  } catch {
    // Non-blocking
  }

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard");

  return { success: true, count: count || leadIds.length };
}

export async function deleteAllLeads() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();

  const { error, count } = await supabase
    .from("leads")
    .delete({ count: "exact" })
    .eq("workspace_id", workspace.workspace_id);

  if (error) throw error;

  try {
    const { logActivity } = await import("@/lib/activity");
    await logActivity("all_leads_purged", { count: count || 0 });
  } catch {
    // Non-blocking
  }

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pipeline");

  return { success: true, count: count || 0 };
}
