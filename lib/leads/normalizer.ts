import { NormalizedLead, RawLeadInput } from "./lead-types";

/**
 * Normalizes email address deterministically:
 * - Trims whitespace
 * - Lowercases
 * - Strips mailto:
 * - Strips wrapping angle brackets or quotes (<user@domain.com> -> user@domain.com)
 * - Strips trailing punctuation
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== "string") return null;

  let cleaned = email.trim().toLowerCase();

  if (cleaned.startsWith("mailto:")) {
    cleaned = cleaned.substring(7).trim();
  }

  cleaned = cleaned.replace(/^[<"']+|[>"']+$/g, "").trim();
  cleaned = cleaned.replace(/[.,;:)]+$/, "");

  if (!cleaned || !cleaned.includes("@")) {
    return null;
  }

  return cleaned;
}

/**
 * Conservative Name Parsing:
 * - Cleans whitespace and quotation marks
 * - Splits full_name into first_name and last_name if individual fields are missing
 * - Preserves original casing unless all-caps
 */
export function parseAndNormalizeNames(
  firstName?: string | null,
  lastName?: string | null,
  fullName?: string | null
): { first_name: string | null; last_name: string | null; full_name: string | null } {
  let first = firstName ? String(firstName).trim() : null;
  let last = lastName ? String(lastName).trim() : null;
  let full = fullName ? String(fullName).trim() : null;

  // Clean empty strings
  if (first === "") first = null;
  if (last === "") last = null;
  if (full === "") full = null;

  // If full_name is present but first or last is missing, split conservatively
  if (full && (!first || !last)) {
    // Strip common honorifics/suffixes
    const cleaned = full
      .replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s+/i, "")
      .replace(/,?\s+(jr\.|sr\.|ii|iii|iv|phd|md)$/i, "")
      .trim();

    const parts = cleaned.split(/\s+/).map((p) => p.replace(/,$/, "").trim()).filter(Boolean);
    if (parts.length === 1) {
      if (!first) first = parts[0];
    } else if (parts.length >= 2) {
      if (!first) first = parts[0];
      if (!last) last = parts.slice(1).join(" ");
    }
  }

  // Construct full_name if missing
  if (!full && (first || last)) {
    full = [first, last].filter(Boolean).join(" ") || null;
  }

  return { first_name: first, last_name: last, full_name: full };
}

/**
 * Non-Destructive Company Normalization:
 * - Trims extraneous whitespace and surrounding quotes
 * - Cleans trailing punctuation
 * - PRESERVES legal suffixes (LLC, Inc, Ltd, etc.) to prevent information destruction
 * - Preserves original casing to protect brand names (e.g. eBay, OpenAI)
 */
export function normalizeCompany(company: string | null | undefined): string | null {
  if (!company || typeof company !== "string") return null;

  let cleaned = company.trim().replace(/^["']+|["']+$/g, "").trim();
  if (!cleaned) return null;

  // Clean trailing commas/dots
  cleaned = cleaned.replace(/[,;:]\s*$/, "").trim();

  return cleaned || null;
}

/**
 * Normalizes website URL and extracts root company domain.
 */
export function normalizeWebsite(url: string | null | undefined): {
  website_url: string | null;
  company_domain: string | null;
} {
  if (!url || typeof url !== "string") {
    return { website_url: null, company_domain: null };
  }

  let cleaned = url.trim().replace(/^[<"']+|[>"']+$/g, "").trim();
  if (!cleaned) return { website_url: null, company_domain: null };

  // Remove trailing slashes
  cleaned = cleaned.replace(/\/+$/, "");

  let normalizedUrl = cleaned;
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  let domain: string | null = null;
  try {
    const parsed = new URL(normalizedUrl);
    domain = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    const match = cleaned.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/i);
    if (match) {
      domain = match[1].toLowerCase();
    }
  }

  return {
    website_url: normalizedUrl,
    company_domain: domain,
  };
}

/**
 * Normalizes phone numbers conservatively, preserving leading + for international format.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== "string") return null;

  const trimmed = phone.trim();
  if (!trimmed) return null;

  const cleaned = trimmed
    .replace(/^(tel|phone|mobile|cell|contact):\s*/i, "")
    .replace(/ext\.?\s*\d+/i, "")
    .trim();

  const hasPlus = cleaned.startsWith("+");
  const digitsOnly = cleaned.replace(/\D/g, "");

  if (digitsOnly.length < 7) {
    return null;
  }

  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

/**
 * Normalizes location string conservatively.
 */
export function normalizeLocation(loc: string | null | undefined): string | null {
  if (!loc || typeof loc !== "string") return null;

  const cleaned = loc.trim().replace(/^["']+|["']+$/g, "").trim();
  if (!cleaned) return null;

  return cleaned
    .split(",")
    .map((part) => {
      const p = part.trim();
      if (p.length === 2 && /^[a-z]{2}$/i.test(p)) {
        return p.toUpperCase();
      }
      return p;
    })
    .join(", ");
}

/**
 * Normalizes LinkedIn URL.
 */
export function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;

  let cleaned = url.trim().replace(/^[<"']+|[>"']+$/g, "").trim();
  if (!cleaned) return null;

  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  if (!cleaned.toLowerCase().includes("linkedin.com")) {
    return null;
  }

  return cleaned.replace(/\/+$/, "");
}

/**
 * Master Normalizer for a single lead record.
 * Preserves unmapped input data in custom_fields for complete auditability.
 */
export function normalizeLeadRecord(
  raw: RawLeadInput,
  workspaceId = "default",
  source = "CSV Import",
  sourceRecordId: string | null = null
): NormalizedLead | null {
  const email = raw.email ? String(raw.email).trim() : "";
  const normalized_email = normalizeEmail(email);

  if (!normalized_email) {
    return null;
  }

  const { first_name, last_name, full_name } = parseAndNormalizeNames(
    raw.first_name ? String(raw.first_name) : null,
    raw.last_name ? String(raw.last_name) : null,
    raw.full_name ? String(raw.full_name) : null
  );

  const company_name = normalizeCompany(
    raw.company_name ? String(raw.company_name) : null
  );

  const { website_url, company_domain } = normalizeWebsite(
    raw.website_url ? String(raw.website_url) : null
  );

  const phone = normalizePhone(raw.phone ? String(raw.phone) : null);
  const location = normalizeLocation(raw.location ? String(raw.location) : null);
  const linkedin_url = normalizeLinkedInUrl(
    raw.linkedin_url ? String(raw.linkedin_url) : null
  );
  const job_title = raw.job_title ? String(raw.job_title).trim() : null;
  const industry = raw.industry ? String(raw.industry).trim() : null;

  // Preserve all unmapped raw attributes in custom_fields
  const knownKeys = new Set([
    "email",
    "first_name",
    "last_name",
    "full_name",
    "company_name",
    "job_title",
    "website_url",
    "linkedin_url",
    "phone",
    "location",
    "industry",
    "source",
    "custom_fields",
    "workspace_id",
    "source_record_id",
  ]);

  const preservedCustom: Record<string, unknown> = {
    ...(typeof raw.custom_fields === "object" && raw.custom_fields !== null
      ? raw.custom_fields
      : {}),
  };

  for (const [key, value] of Object.entries(raw)) {
    if (!knownKeys.has(key) && value !== undefined && value !== null && value !== "") {
      preservedCustom[key] = value;
    }
  }

  return {
    workspace_id: workspaceId,
    email: email || normalized_email,
    normalized_email,
    first_name,
    last_name,
    full_name,
    company_name,
    company_domain,
    job_title,
    phone,
    website_url,
    linkedin_url,
    location,
    industry,
    source,
    source_record_id: sourceRecordId,
    custom_fields: preservedCustom,
  };
}
