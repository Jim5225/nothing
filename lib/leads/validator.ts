import { NormalizedLead, LeadValidationResult } from "./lead-types";

// Standard practical email regex: checks user part, @, domain part with dot and valid TLD
const PRACTICAL_EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Obvious placeholder / dummy email patterns
const PLACEHOLDER_EMAILS = new Set([
  "test@test.com",
  "example@example.com",
  "admin@example.com",
  "user@example.com",
  "placeholder@email.com",
  "sample@sample.com",
  "na@na.com",
  "none@none.com",
]);

/**
 * Practical email syntax validation:
 * Distinguishes missing email vs syntactically invalid email vs valid email format.
 * (Note: Syntax validation does not guarantee mailbox deliverability).
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
    return { valid: false, reason: "Email exceeds 254 characters" };
  }

  if (PLACEHOLDER_EMAILS.has(trimmed)) {
    return { valid: false, reason: "Placeholder or test email address rejected" };
  }

  if (!PRACTICAL_EMAIL_REGEX.test(trimmed)) {
    return { valid: false, reason: "Invalid email syntax format" };
  }

  const parts = trimmed.split("@");
  if (parts.length !== 2) {
    return { valid: false, reason: "Email must contain exactly one @ symbol" };
  }

  const [localPart, domainPart] = parts;

  if (localPart.length === 0 || localPart.length > 64) {
    return { valid: false, reason: "Email username length is invalid" };
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
 * Checks a list of leads against workspace suppression list.
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
