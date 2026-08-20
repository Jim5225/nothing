import { NormalizedLead } from "./lead-types";

/**
 * Merges two lead records, prioritizing non-empty values.
 */
export function mergeLeadRecords(primary: NormalizedLead, incoming: NormalizedLead): NormalizedLead {
  return {
    ...primary,
    first_name: primary.first_name || incoming.first_name || null,
    last_name: primary.last_name || incoming.last_name || null,
    full_name: primary.full_name || incoming.full_name || null,
    company_name: primary.company_name || incoming.company_name || null,
    company_domain: primary.company_domain || incoming.company_domain || null,
    job_title: primary.job_title || incoming.job_title || null,
    phone: primary.phone || incoming.phone || null,
    website_url: primary.website_url || incoming.website_url || null,
    linkedin_url: primary.linkedin_url || incoming.linkedin_url || null,
    location: primary.location || incoming.location || null,
    industry: primary.industry || incoming.industry || null,
    custom_fields: {
      ...incoming.custom_fields,
      ...primary.custom_fields,
    },
  };
}

/**
 * Deduplicates leads within the same incoming batch.
 * Groups by normalized_email (primary) and merges secondary info.
 */
export function deduplicateInBatch(leads: NormalizedLead[]): {
  uniqueLeads: NormalizedLead[];
  inBatchDuplicates: number;
} {
  const emailMap = new Map<string, NormalizedLead>();
  let inBatchDuplicates = 0;

  for (const lead of leads) {
    const key = lead.normalized_email;
    if (emailMap.has(key)) {
      const existing = emailMap.get(key)!;
      emailMap.set(key, mergeLeadRecords(existing, lead));
      inBatchDuplicates++;
    } else {
      emailMap.set(key, lead);
    }
  }

  // Secondary pass: Deduplicate by phone if phone is non-null
  // REMOVED: Phone numbers must not be treated as a definitive duplicate.
  // Primary hard duplicate identity is workspace_id + normalized_email.
  const finalLeads: NormalizedLead[] = Array.from(emailMap.values());

  return {
    uniqueLeads: finalLeads,
    inBatchDuplicates,
  };
}

/**
 * Partitions leads into new leads vs existing leads based on database email index.
 */
export function partitionExistingLeads(
  leads: NormalizedLead[],
  existingEmails: Set<string>
): {
  newLeads: NormalizedLead[];
  existingLeads: NormalizedLead[];
} {
  const newLeads: NormalizedLead[] = [];
  const existingLeads: NormalizedLead[] = [];

  for (const lead of leads) {
    if (existingEmails.has(lead.normalized_email)) {
      existingLeads.push(lead);
    } else {
      newLeads.push(lead);
    }
  }

  return { newLeads, existingLeads };
}
