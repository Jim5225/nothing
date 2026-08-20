export interface RawLeadInput {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  company_name?: string | null;
  job_title?: string | null;
  website_url?: string | null;
  linkedin_url?: string | null;
  phone?: string | null;
  location?: string | null;
  industry?: string | null;
  source?: string | null;
  custom_fields?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface NormalizedLead {
  workspace_id: string;
  email: string;
  normalized_email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  company_name: string | null;
  company_domain: string | null;
  job_title: string | null;
  phone: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  location: string | null;
  industry: string | null;
  source: string;
  source_record_id: string | null;
  custom_fields: Record<string, unknown>;
}

export interface LeadValidationError {
  row: number;
  email?: string;
  reason: string;
  raw?: unknown;
}

export interface LeadValidationResult {
  valid: boolean;
  lead?: NormalizedLead;
  errors: string[];
}

export interface ImportStats {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  failedRows: number;
}

export interface LeadImportResult {
  success: boolean;
  importId?: string;
  stats: ImportStats;
  errors?: LeadValidationError[];
  error?: string;
}

export type InputFormatType = "csv" | "markdown" | "json" | "unstructured_text" | "empty";
