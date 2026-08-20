import {
  normalizeEmail,
  titleCaseName,
  parseAndNormalizeNames,
  normalizeCompany,
  normalizeWebsite,
  normalizePhone,
  normalizeLocation,
  normalizeLinkedInUrl,
  normalizeLeadRecord,
} from "../normalizer";
import { validateEmail, validateLead, partitionSuppressedLeads } from "../validator";
import { deduplicateInBatch, mergeLeadRecords, partitionExistingLeads } from "../deduplicator";
import { detectInputFormat, parseMarkdownTable, parseCSVText, parseRawInput, chunkText } from "../parser";
import { NormalizedLead, RawLeadInput } from "../lead-types";

// Simple test framework
let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${details ? `(${details})` : ""}`);
    failedCount++;
  }
}

function assertEquals(actual: unknown, expected: unknown, testName: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  assert(actualStr === expectedStr, testName, `Expected: ${expectedStr}, Got: ${actualStr}`);
}

console.log("\n==========================================");
console.log("RUNNING LEAD INGESTION & NORMALIZATION TESTS");
console.log("==========================================\n");

// ── 1. Normalizer Tests ──────────────────────────────────────────────────────
console.log("1. Normalizer Tests:");

assertEquals(normalizeEmail("  JOHN.DOE@Example.COM  "), "john.doe@example.com", "Normalizes email casing and whitespace");
assertEquals(normalizeEmail("<sarah@domain.co.uk>"), "sarah@domain.co.uk", "Strips angle brackets from email");
assertEquals(normalizeEmail("mailto:alex@acme.org."), "alex@acme.org", "Strips mailto: prefix and trailing punctuation");
assertEquals(normalizeEmail(""), null, "Empty email returns null");
assertEquals(normalizeEmail(null), null, "Null email returns null");

assertEquals(titleCaseName("SARAH CONNOR"), "Sarah Connor", "Title-cases all-caps name");
assertEquals(titleCaseName("o'connor"), "O'Connor", "Handles apostrophe names");
assertEquals(titleCaseName("jean-luc picard"), "Jean-Luc Picard", "Handles hyphenated names");

const splitResult = parseAndNormalizeNames(null, null, "Dr. Bruce Wayne, Jr.");
assertEquals(splitResult.first_name, "Bruce", "Extracts first name from full name ignoring Dr.");
assertEquals(splitResult.last_name, "Wayne", "Extracts last name from full name ignoring Jr.");
assertEquals(splitResult.full_name, "Dr. Bruce Wayne, Jr.", "Preserves title-cased full name");

assertEquals(normalizeCompany("  cyberdyne systems, llc.  "), "Cyberdyne Systems", "Cleans company casing and suffix");
assertEquals(normalizeCompany("IBM"), "IBM", "Preserves uppercase short acronyms for companies");

const webResult = normalizeWebsite("www.apple.com/iphone/");
assertEquals(webResult.website_url, "https://www.apple.com/iphone", "Normalizes website url with https");
assertEquals(webResult.company_domain, "apple.com", "Extracts clean root domain");

assertEquals(normalizePhone("+1 (555) 123-4567 ext. 88"), "+15551234567", "Cleans phone and preserves country code");
assertEquals(normalizePhone("123"), null, "Rejects invalid short phone");

assertEquals(normalizeLocation("san francisco, ca"), "San Francisco, CA", "Normalizes city and 2-letter state code");
assertEquals(normalizeLinkedInUrl("linkedin.com/in/johndoe/"), "https://linkedin.com/in/johndoe", "Normalizes LinkedIn profile URL");

// Test Lead Record Normalization with Custom Fields Preservation
const rawLead: RawLeadInput = {
  email: "Tony.Stark@StarkIndustries.com",
  full_name: "Tony Stark",
  company_name: "Stark Industries, Inc.",
  job_title: "CEO & Chief Engineer",
  website_url: "starkindustries.com",
  phone: "+1 800 555 9999",
  location: "Malibu, CA, USA",
  annual_revenue: "$10B",
  notes: "Key VIP client",
};

const normalized = normalizeLeadRecord(rawLead, "ws-123", "CSV Import", "imp-456");
assert(normalized !== null, "Successfully normalizes complete lead record");
assertEquals(normalized?.normalized_email, "tony.stark@starkindustries.com", "Lead normalized_email correct");
assertEquals(normalized?.first_name, "Tony", "Lead first_name correct");
assertEquals(normalized?.last_name, "Stark", "Lead last_name correct");
assertEquals(normalized?.company_name, "Stark Industries", "Lead company_name cleaned");
assertEquals(normalized?.company_domain, "starkindustries.com", "Lead company_domain extracted");
assertEquals(normalized?.custom_fields?.annual_revenue, "$10B", "Preserves unmapped field annual_revenue");
assertEquals(normalized?.custom_fields?.notes, "Key VIP client", "Preserves unmapped field notes");

// ── 2. Validator Tests ───────────────────────────────────────────────────────
console.log("\n2. Validator Tests:");

assert(validateEmail("user@domain.com").valid, "Validates standard email");
assert(validateEmail("user.name+tag@sub.domain.co.uk").valid, "Validates complex sub-domain email with tag");
assert(!validateEmail("plainaddress").valid, "Rejects email missing @ and domain");
assert(!validateEmail("@missinguser.com").valid, "Rejects email missing username");
assert(!validateEmail("user@domain").valid, "Rejects email missing TLD");
assert(!validateEmail("test@test.com").valid, "Rejects placeholder dummy email");
assert(!validateEmail("").valid, "Rejects empty string");

const validLeadObj: NormalizedLead = {
  workspace_id: "ws-123",
  email: "valid@company.com",
  normalized_email: "valid@company.com",
  first_name: "Valid",
  last_name: "User",
  full_name: "Valid User",
  company_name: "Company",
  company_domain: "company.com",
  job_title: "Lead",
  phone: "+15551234567",
  website_url: "https://company.com",
  linkedin_url: null,
  location: "New York, NY",
  industry: "Tech",
  source: "CSV",
  source_record_id: null,
  custom_fields: {},
};

assert(validateLead(validLeadObj).valid, "Validates correct NormalizedLead record");

const invalidLeadObj = { ...validLeadObj, normalized_email: "not-an-email" };
assert(!validateLead(invalidLeadObj).valid, "Rejects lead with invalid normalized_email");

const suppressed = new Set(["suppressed@bad.com"]);
const { active, suppressed: foundSuppressed } = partitionSuppressedLeads(
  [validLeadObj, { ...validLeadObj, normalized_email: "suppressed@bad.com" }],
  suppressed
);
assertEquals(active.length, 1, "Active leads count after suppression check is 1");
assertEquals(foundSuppressed.length, 1, "Suppressed leads correctly identified");

// ── 3. Deduplicator Tests ────────────────────────────────────────────────────
console.log("\n3. Deduplicator Tests:");

const leadA: NormalizedLead = {
  ...validLeadObj,
  email: "clark.kent@dailyplanet.com",
  normalized_email: "clark.kent@dailyplanet.com",
  first_name: "Clark",
  last_name: null,
  company_name: "Daily Planet",
  phone: null,
};

const leadB: NormalizedLead = {
  ...validLeadObj,
  email: "clark.kent@dailyplanet.com",
  normalized_email: "clark.kent@dailyplanet.com",
  first_name: null,
  last_name: "Kent",
  phone: "+15550001111",
};

const merged = mergeLeadRecords(leadA, leadB);
assertEquals(merged.first_name, "Clark", "Merges non-empty first_name");
assertEquals(merged.last_name, "Kent", "Merges non-empty last_name");
assertEquals(merged.phone, "+15550001111", "Merges non-empty phone");
assertEquals(merged.company_name, "Daily Planet", "Preserves company_name");

const { uniqueLeads, inBatchDuplicates } = deduplicateInBatch([leadA, leadB, validLeadObj]);
assertEquals(uniqueLeads.length, 2, "Deduplicates 3 rows to 2 unique leads");
assertEquals(inBatchDuplicates, 1, "Correct in-batch duplicate count");

const existingDbEmails = new Set(["valid@company.com"]);
const { newLeads, existingLeads } = partitionExistingLeads(uniqueLeads, existingDbEmails);
assertEquals(newLeads.length, 1, "Correct new leads count against DB");
assertEquals(existingLeads.length, 1, "Correct existing leads count against DB");

// ── 4. Parser & Format Detection Tests ───────────────────────────────────────
console.log("\n4. Parser & Format Detection Tests:");

assertEquals(detectInputFormat(""), "empty", "Detects empty input");
assertEquals(detectInputFormat("   \n\t  "), "empty", "Detects whitespace as empty");
assertEquals(detectInputFormat('[{"email":"test@a.com"}]'), "json", "Detects JSON input");

const sampleMarkdown = `
| Name | Email | Company |
|---|---|---|
| Peter Parker | peter@dailybugle.com | Daily Bugle |
| Harry Osborn | harry@oscorp.com | Oscorp |
`;
assertEquals(detectInputFormat(sampleMarkdown), "markdown", "Detects Markdown table format");

const parsedMd = parseMarkdownTable(sampleMarkdown);
assertEquals(parsedMd.length, 2, "Parses 2 markdown rows");
assertEquals(parsedMd[0]["Email"], "peter@dailybugle.com", "Correctly extracts email from markdown table");

const sampleCSV = `First Name,Last Name,Email,Company\nBruce,Wayne,bruce@wayne.com,Wayne Enterprises\nDiana,Prince,diana@themyscira.gov,Amazon`;
assertEquals(detectInputFormat(sampleCSV), "csv", "Detects CSV format");

const parsedCSV = parseCSVText(sampleCSV);
assertEquals(parsedCSV.length, 2, "Parses 2 CSV rows");
assertEquals(parsedCSV[0]["Email"], "bruce@wayne.com", "Correctly extracts email from CSV");

const chunks = chunkText("line1\nline2\nline3\nline4", 12);
assert(chunks.length >= 2, "Correctly chunks text at newline boundaries without truncation");

// ── 5. Empty & Malformed Input Handling Tests ────────────────────────────────
console.log("\n5. Empty & Malformed Input Handling Tests:");

const parsedEmpty = parseRawInput("");
assertEquals(parsedEmpty.format, "empty", "Empty string returns empty format");
assertEquals(parsedEmpty.rows?.length, 0, "Empty input has 0 rows");

// ── 6. Mixed Malformed & Valid Batch Ingestion Tests ─────────────────────────
console.log("\n6. Mixed Malformed & Valid Batch Ingestion Tests:");

const mixedBatch: RawLeadInput[] = [
  { email: "valid1@corp.com", full_name: "Alice Johnson", company_name: "Corp A" },
  { email: "", full_name: "Empty Email" }, // invalid
  { email: "bad-email", full_name: "Bad Email" }, // invalid
  { email: "valid2@corp.com", full_name: "Bob Smith", company_name: "Corp B" },
  { email: null, full_name: "Null Email" }, // invalid
  { email: "VALID1@CORP.COM", phone: "+1 555 999 0000" }, // duplicate of valid1
  { email: "valid3@corp.com", full_name: "Charlie Brown", company_name: "Corp C, LLC." },
];

const normalizedBatch: NormalizedLead[] = [];
let invalidCount = 0;

for (const raw of mixedBatch) {
  const norm = normalizeLeadRecord(raw, "ws-test", "Test Batch");
  if (norm && validateLead(norm).valid) {
    normalizedBatch.push(norm);
  } else {
    invalidCount++;
  }
}

assertEquals(invalidCount, 3, "Correctly identifies 3 invalid rows");
assertEquals(normalizedBatch.length, 4, "Extracts 4 valid normalized leads before dedup");

const { uniqueLeads: dedupedMixed, inBatchDuplicates: mixedDupes } = deduplicateInBatch(normalizedBatch);
assertEquals(dedupedMixed.length, 3, "Produces exactly 3 unique leads after deduplication");
assertEquals(mixedDupes, 1, "Detects 1 duplicate in mixed batch");
assertEquals(dedupedMixed[0].phone, "+15559990000", "Successfully merged phone into valid1 record");

// ── 7. Large Dataset Stress Test (1,000 Records) ─────────────────────────────
console.log("\n7. Large Dataset Stress Test (1,000 Records):");

const largeDataset: RawLeadInput[] = [];
for (let i = 1; i <= 1000; i++) {
  // Generate 800 unique leads and 200 duplicate variations
  const id = i <= 800 ? i : i - 200;
  largeDataset.push({
    email: `User.${id}@Enterprise-Corp.COM`,
    full_name: `Lead Number ${id}`,
    company_name: `Company ${id}, Inc.`,
    job_title: id % 2 === 0 ? "VP of Engineering" : "Director of Sales",
    phone: `+1 555 ${String(1000000 + id).slice(1)}`,
    website_url: `https://company${id}.io/home`,
    location: id % 2 === 0 ? "Austin, TX" : "Seattle, WA",
    custom_attribute: `Meta_${id}`,
  });
}

const start = performance.now();
const largeNormalized: NormalizedLead[] = [];
for (const raw of largeDataset) {
  const norm = normalizeLeadRecord(raw, "ws-large");
  if (norm && validateLead(norm).valid) {
    largeNormalized.push(norm);
  }
}
const { uniqueLeads: largeUnique, inBatchDuplicates: largeDupes } = deduplicateInBatch(largeNormalized);
const elapsed = performance.now() - start;

assertEquals(largeNormalized.length, 1000, "Normalizes all 1,000 records without error");
assertEquals(largeUnique.length, 800, "Correctly yields 800 unique leads from 1,000 records with 200 duplicates");
assertEquals(largeDupes, 200, "Correctly counts 200 duplicates");
assert(elapsed < 1000, `Processed 1,000 records in ${elapsed.toFixed(1)}ms (< 1000ms threshold)`);

// ── Summary ──────────────────────────────────────────────────────────────────
console.log("\n==========================================");
console.log(`TEST RUN COMPLETE: ${passedCount} Passed, ${failedCount} Failed`);
console.log("==========================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
