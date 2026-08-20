"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

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

export async function processLeadImport(
  filename: string,
  totalRows: number,
  mappedData: Record<string, string>[]
) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");
  const workspaceId = workspace.workspace_id;

  const supabase = await createClient();

  // 1. Create lead_import record
  const { data: importRecord, error: importError } = await supabase
    .from("lead_imports")
    .insert({
      workspace_id: workspaceId,
      filename,
      total_rows: totalRows,
      status: "processing",
    })
    .select()
    .single();

  if (importError) throw importError;

  let importedRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;
  let failedRows = 0;

  const validLeads = [];

  // 2. Validate & Normalize
  for (const row of mappedData) {
    if (!row.email || typeof row.email !== "string" || !row.email.includes("@")) {
      invalidRows++;
      continue;
    }

    const normalized_email = row.email.trim().toLowerCase();

    // Clean names
    const cleanName = (name?: string) =>
      name ? name.trim().charAt(0).toUpperCase() + name.trim().slice(1) : null;

    const first_name = cleanName(row.first_name);
    const last_name = cleanName(row.last_name);
    const full_name = row.full_name
      ? row.full_name.trim()
      : first_name && last_name
      ? `${first_name} ${last_name}`
      : first_name || last_name || null;

    validLeads.push({
      workspace_id: workspaceId,
      email: row.email.trim(),
      normalized_email,
      first_name,
      last_name,
      full_name,
      company_name: row.company_name?.trim() || null,
      job_title: row.job_title?.trim() || null,
      website_url: row.website_url?.trim() || null,
      linkedin_url: row.linkedin_url?.trim() || null,
      phone: row.phone?.trim() || null,
      location: row.location?.trim() || null,
      industry: row.industry?.trim() || null,
      source: "CSV Import",
      source_record_id: importRecord.id,
    });
  }

  // 3. Batch Insert with Deduplication
  if (validLeads.length > 0) {
    const chunkSize = 1000;
    for (let i = 0; i < validLeads.length; i += chunkSize) {
      const chunk = validLeads.slice(i, i + chunkSize);

      const { data: inserted, error: insertError } = await supabase
        .from("leads")
        .upsert(chunk, {
          onConflict: "workspace_id,normalized_email",
          ignoreDuplicates: true,
        })
        .select("id");

      if (insertError) {
        failedRows += chunk.length;
      } else {
        const insertedCount = inserted?.length || 0;
        importedRows += insertedCount;
        duplicateRows += chunk.length - insertedCount;
      }
    }
  }

  // 4. Update import record
  await supabase
    .from("lead_imports")
    .update({
      valid_rows: validLeads.length,
      invalid_rows: invalidRows,
      duplicate_rows: duplicateRows,
      imported_rows: importedRows,
      failed_rows: failedRows,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", importRecord.id);

  const { logActivity } = await import("@/lib/activity");
  await logActivity("csv_import", { 
    filename, 
    imported: importedRows, 
    duplicates: duplicateRows 
  });

  revalidatePath("/dashboard/leads");

  return {
    success: true,
    stats: {
      totalRows,
      validRows: validLeads.length,
      invalidRows,
      duplicateRows,
      importedRows,
      failedRows,
    },
  };
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

  const { logActivity } = await import("@/lib/activity");
  await logActivity("leads_deleted", { count: count || leadIds.length });

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard");

  return { success: true, count: count || leadIds.length };
}

export async function deleteAllLeads() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();

  // Delete all leads for the workspace
  const { error, count } = await supabase
    .from("leads")
    .delete({ count: "exact" })
    .eq("workspace_id", workspace.workspace_id);

  if (error) throw error;

  const { logActivity } = await import("@/lib/activity");
  await logActivity("all_leads_purged", { count: count || 0 });

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pipeline");

  return { success: true, count: count || 0 };
}

