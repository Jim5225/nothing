import { NormalizedLead, RawLeadInput } from "./lead-types";

/**
 * Normalizes email address by trimming, lowercasing, and removing artifacts.
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== "string") return null;

  let cleaned = email.trim().toLowerCase();

  // Strip mailto: prefix
  if (cleaned.startsWith("mailto:")) {
    cleaned = cleaned.substring(7).trim();
  }

  // Strip wrapping angle brackets or quotes: <user@example.com> or "user@example.com"
  cleaned = cleaned.replace(/^[<"']+|[>"']+$/g, "").trim();

  // Remove any trailing periods, commas, or semicolons
  cleaned = cleaned.replace(/[.,;:)]+$/, "");

  if (!cleaned || !cleaned.includes("@")) {
    return null;
  }

  return cleaned;
}

/**
 * Capitalizes names with support for hyphenated and apostrophe-containing names (e.g. O'Connor, Jean-Luc).
 */
export function titleCaseName(str: string | null | undefined): string | null {
  if (!str || typeof str !== "string") return null;

  const trimmed = str.trim().replace(/^["']+|["']+$/g, "");
  if (!trimmed) return null;

  // Split by whitespace and capitalize each word
  return trimmed
    .split(/\s+/)
    .map((word) => {
      // Handle hyphenated names like Jean-Luc
      return word
        .split("-")
        .map((part) => {
          // Handle apostrophes like O'Connor
          return part
            .split("'")
            .map((sub) => {
              if (!sub) return "";
              return sub.charAt(0).toUpperCase() + sub.slice(1).toLowerCase();
            })
            .join("'");
        })
        .join("-");
    })
    .join(" ");
}

/**
 * Intelligently splits a full name into first and last names.
 */
export function parseAndNormalizeNames(
  firstName?: string | null,
  lastName?: string | null,
  fullName?: string | null
): { first_name: string | null; last_name: string | null; full_name: string | null } {
  let first = firstName ? titleCaseName(firstName) : null;
  let last = lastName ? titleCaseName(lastName) : null;
  let full = fullName ? titleCaseName(fullName) : null;

  // If full_name is present but first/last are missing
  if (full && (!first || !last)) {
    // Remove common prefixes and suffixes (including leading comma)
    const cleanedFull = full
      .replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s+/i, "")
      .replace(/,?\s+(jr\.|sr\.|ii|iii|iv|phd|md)$/i, "")
      .trim();

    const parts = cleanedFull.split(/\s+/).map((p) => p.replace(/,$/, "").trim()).filter(Boolean);
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
 * Normalizes company name: trims, cleans quotes, standardizes corporate suffixes.
 */
export function normalizeCompany(company: string | null | undefined): string | null {
  if (!company || typeof company !== "string") return null;

  let cleaned = company.trim().replace(/^["']+|["']+$/g, "").trim();
  if (!cleaned) return null;

  // Clean trailing commas/dots first
  cleaned = cleaned.replace(/[.,;:]\s*$/, "").trim();

  // Strip trailing legal suffixes: LLC, Inc, Ltd, Corp, GmbH, Co
  cleaned = cleaned.replace(/,?\s+(llc\.?|inc\.?|ltd\.?|corp\.?|gmbh|co\.?)$/i, "").trim();

  // Clean trailing commas/dots again
  cleaned = cleaned.replace(/[.,;:]\s*$/, "").trim();

  // If company is in all-caps or all-lower, title-case it
  if (cleaned === cleaned.toUpperCase() || cleaned === cleaned.toLowerCase()) {
    cleaned = cleaned
      .split(/\s+/)
      .map((w) => {
        // Keep acronyms like IBM, AI, USA in uppercase if length <= 3
        if (w.length <= 3 && /^[A-Z0-9]+$/i.test(w)) return w.toUpperCase();
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(" ");
  }

  return cleaned || null;
}

/**
 * Normalizes website URL and extracts company domain.
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

  // Prepend https:// if no protocol
  let normalizedUrl = cleaned;
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  let domain: string | null = null;
  try {
    const parsed = new URL(normalizedUrl);
    domain = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    // If URL parsing fails, extract simple domain pattern
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
 * Normalizes phone numbers, stripping unwanted noise while preserving international country codes.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== "string") return null;

  const trimmed = phone.trim();
  if (!trimmed) return null;

  // Remove unwanted words like 'ext.', 'phone:', 'tel:'
  const cleaned = trimmed
    .replace(/^(tel|phone|mobile|cell|contact):\s*/i, "")
    .replace(/ext\.?\s*\d+/i, "")
    .trim();

  // If starts with +, preserve it, remove other non-digit characters except dashes/spaces
  const hasPlus = cleaned.startsWith("+");
  const digitsOnly = cleaned.replace(/\D/g, "");

  if (digitsOnly.length < 7) {
    // Invalid phone length
    return null;
  }

  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

/**
 * Normalizes location string (City, State, Country).
 */
export function normalizeLocation(loc: string | null | undefined): string | null {
  if (!loc || typeof loc !== "string") return null;

  const cleaned = loc.trim().replace(/^["']+|["']+$/g, "").trim();
  if (!cleaned) return null;

  return cleaned
    .split(",")
    .map((part) => {
      const p = part.trim();
      // Handle state abbreviations like "CA", "NY" (2 letters)
      if (p.length === 2 && /^[a-z]{2}$/i.test(p)) {
        return p.toUpperCase();
      }
      return titleCaseName(p) || p;
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

  // Ensure linkedin.com domain
  if (!cleaned.toLowerCase().includes("linkedin.com")) {
    return null;
  }

  return cleaned.replace(/\/+$/, "");
}

/**
 * Master Normalizer for a single lead record.
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
  const job_title = raw.job_title ? titleCaseName(String(raw.job_title)) : null;
  const industry = raw.industry ? titleCaseName(String(raw.industry)) : null;

  // Preserve any unmapped / raw attributes in custom_fields
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
