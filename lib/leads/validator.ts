import { NormalizedLead, LeadValidationResult } from "./lead-types";

// Standard RFC 5322 compliant regex for practical email validation
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Common dummy/placeholder email patterns to reject
const PLACEHOLDER_EMAILS = new Set([
  "test@test.com",
  "example@example.com",
  "admin@example.com",
  "user@example.com",
  "info@example.com",
  "placeholder@email.com",
  "sample@sample.com",
  "na@na.com",
  "none@none.com",
]);

/**
 * Validates email address format and checks for invalid/placeholder emails.
 */
export function validateEmail(email: string | null | undefined): {
  valid: boolean;
  reason?: string;
} {
  if (!email || typeof email !== "string") {
    return { valid: false, reason: "Email is missing or empty" };
  }

  const trimmed = email.trim().toLowerCase();

  if (trimmed.length > 254) {
    return { valid: false, reason: "Email exceeds maximum length of 254 characters" };
  }

  if (PLACEHOLDER_EMAILS.has(trimmed)) {
    return { valid: false, reason: "Placeholder or test email address rejected" };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, reason: "Invalid email syntax format" };
  }

  const parts = trimmed.split("@");
  if (parts.length !== 2) {
    return { valid: false, reason: "Email must contain exactly one @ symbol" };
  }

  const [localPart, domainPart] = parts;

  if (localPart.length === 0 || localPart.length > 64) {
    return { valid: false, reason: "Email username part length is invalid" };
  }

  if (!domainPart.includes(".")) {
    return { valid: false, reason: "Email domain must contain at least one dot" };
  }

  const domainLabels = domainPart.split(".");
  const tld = domainLabels[domainLabels.length - 1];

  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
    return { valid: false, reason: "Email domain has an invalid top-level domain (TLD)" };
  }

  return { valid: true };
}

/**
 * Validates a normalized lead record against business rules.
 */
export function validateLead(lead: NormalizedLead | null | undefined): LeadValidationResult {
  if (!lead) {
    return { valid: false, errors: ["Lead record is null or undefined"] };
  }

  const errors: string[] = [];

  if (!lead.workspace_id) {
    errors.push("Missing workspace_id");
  }

  const emailCheck = validateEmail(lead.normalized_email);
  if (!emailCheck.valid) {
    errors.push(emailCheck.reason || "Invalid email address");
  }

  return {
    valid: errors.length === 0,
    lead: errors.length === 0 ? lead : undefined,
    errors,
  };
}

/**
 * Checks a list of leads against a set of suppressed emails.
 */
export function partitionSuppressedLeads(
  leads: NormalizedLead[],
  suppressedEmails: Set<string>
): { active: NormalizedLead[]; suppressed: NormalizedLead[] } {
  const active: NormalizedLead[] = [];
  const suppressed: NormalizedLead[] = [];

  for (const lead of leads) {
    if (suppressedEmails.has(lead.normalized_email)) {
      suppressed.push(lead);
    } else {
      active.push(lead);
    }
  }

  return { active, suppressed };
}
