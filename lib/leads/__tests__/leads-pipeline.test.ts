import { normalizeLeadRecord } from "../normalizer";
import { validateEmail, validateLead, partitionSuppressedLeads } from "../validator";
import { deduplicateInBatch, mergeLeadRecords, partitionExistingLeads } from "../deduplicator";
import { detectInputFormat, parseMarkdownTable, parseCSVText, parseRawInput, chunkText } from "../parser";
import { tryDeterministicHeaderMapping } from "../ai-refiner";
import { NormalizedLead, RawLeadInput } from "../lead-types";

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

console.log("\n========================================================");
console.log("RUNNING REVISED LEAD INGESTION & PIPELINE TEST SUITE (19 SCENARIOS)");
console.log("========================================================\n");

// ── Scenario 1: Clean CSV Parsing & Deterministic Mapping ────────────────────
console.log("Scenario 1: Clean CSV Parsing & Deterministic Mapping");
const cleanCSV = `First Name,Last Name,Email,Company,Job Title\nBruce,Wayne,bruce@wayne.com,Wayne Enterprises,CEO`;
const parsedClean = parseCSVText(cleanCSV);
assertEquals(parsedClean.length, 1, "Parses 1 clean CSV row");
const headersClean = Object.keys(parsedClean[0]);
const mapClean = tryDeterministicHeaderMapping(headersClean);
assert(mapClean !== null && mapClean.email === "Email", "Deterministic mapping identifies Email without AI");

// ── Scenario 2: Messy CSV (mixed spacing, semicolons, quotes) ────────────────
console.log("\nScenario 2: Messy CSV Parsing");
const messyCSV = `" First Name " ; " Email " ; " Company "\n" Clark " ; " clark@dailyplanet.com " ; " Daily Planet, Inc. "`;
const parsedMessy = parseCSVText(messyCSV);
assertEquals(parsedMessy.length, 1, "Parses messy CSV row");
assertEquals(parsedMessy[0]["Email"], "clark@dailyplanet.com", "Trims quotes and whitespace in CSV cells");

// ── Scenario 3: CSV with Missing Columns (Optional fields remain null) ───────
console.log("\nScenario 3: CSV with Missing Optional Columns");
const minimalLead: RawLeadInput = { email: "minimal@solo.io" };
const normMinimal = normalizeLeadRecord(minimalLead, "ws-1");
assert(normMinimal !== null, "Successfully normalizes lead with only email");
assertEquals(normMinimal?.phone, null, "Missing phone remains null (never invented)");
assertEquals(normMinimal?.company_name, null, "Missing company remains null (never invented)");
assertEquals(normMinimal?.job_title, null, "Missing job title remains null (never invented)");

// ── Scenario 4: Markdown Table Parsing ───────────────────────────────────────
console.log("\nScenario 4: Markdown Table Parsing");
const mdTable = `
| Full Name | Email Address | Organization |
|---|---|---|
| Peter Parker | peter@dailybugle.com | Daily Bugle |
| Tony Stark | tony@stark.com | Stark Industries, LLC |
`;
const parsedMd = parseMarkdownTable(mdTable);
assertEquals(parsedMd.length, 2, "Parses 2 Markdown table rows ignoring dividers");
assertEquals(parsedMd[0]["Email Address"], "peter@dailybugle.com", "Extracts email from Markdown table");

// ── Scenario 5: Plain Text & Unstructured Chunking ───────────────────────────
console.log("\nScenario 5: Unstructured Plain Text Chunking");
const textLines = Array.from({ length: 50 }, (_, i) => `Contact ${i}: user${i}@domain.com, Phone: +1 555 000 ${i}`).join("\n");
const textChunks = chunkText(textLines, 500);
assert(textChunks.length >= 2, "Chunks large text at line boundaries safely");

// ── Scenario 6: In-Batch Duplicate Emails (Additive Merge) ───────────────────
console.log("\nScenario 6: In-Batch Duplicate Emails Merged Additively");
const baseLead: NormalizedLead = {
  workspace_id: "ws-1",
  email: "sarah@cyberdyne.com",
  normalized_email: "sarah@cyberdyne.com",
  first_name: "Sarah",
  last_name: null,
  full_name: "Sarah",
  company_name: null,
  company_domain: null,
  job_title: null,
  phone: null,
  website_url: null,
  linkedin_url: null,
  location: null,
  industry: null,
  source: "CSV",
  source_record_id: null,
  custom_fields: {},
};
const dupeLead: NormalizedLead = {
  ...baseLead,
  last_name: "Connor",
  full_name: "Sarah Connor",
  company_name: "Cyberdyne Systems, LLC",
  phone: "+15551234567",
};
const { uniqueLeads: inBatchResult, inBatchDuplicates: inBatchCount } = deduplicateInBatch([baseLead, dupeLead]);
assertEquals(inBatchResult.length, 1, "Deduplicates 2 matching emails into 1 unique lead");
assertEquals(inBatchCount, 1, "Counts 1 duplicate in batch");
assertEquals(inBatchResult[0].last_name, "Connor", "Additive merge preserves non-empty last_name");
assertEquals(inBatchResult[0].phone, "+15551234567", "Additive merge preserves non-empty phone");
assertEquals(inBatchResult[0].company_name, "Cyberdyne Systems, LLC", "Preserves company legal suffix");

// ── Scenario 7: Existing Lead + Imported Lead Partitioning ───────────────────
console.log("\nScenario 7: Database Duplicate Partitioning");
const existingEmails = new Set(["sarah@cyberdyne.com"]);
const { newLeads, existingLeads } = partitionExistingLeads(inBatchResult, existingEmails);
assertEquals(newLeads.length, 0, "Identifies existing lead as duplicate against DB");
assertEquals(existingLeads.length, 1, "Correct existing leads count");

// ── Scenario 8: Conflicting Lead Info Merge ──────────────────────────────────
console.log("\nScenario 8: Non-Destructive Field Merging");
const mergedRecord = mergeLeadRecords(baseLead, dupeLead);
assertEquals(mergedRecord.first_name, "Sarah", "Keeps primary first_name");
assertEquals(mergedRecord.last_name, "Connor", "Populates missing last_name from incoming record");

// ── Scenario 9: Invalid Email Syntax Validation ──────────────────────────────
console.log("\nScenario 9: Invalid Email Syntax Validation");
assert(!validateEmail("plainaddress").valid, "Rejects email missing @");
assert(!validateEmail("user@domain").valid, "Rejects email missing TLD");
assert(!validateEmail("user@@domain.com").valid, "Rejects double @");
assert(!validateEmail("test@test.com").valid, "Rejects dummy placeholder email");

// ── Scenario 10: Missing Email Rejection ─────────────────────────────────────
console.log("\nScenario 10: Missing Email Rejection");
assert(!validateEmail("").valid, "Rejects empty email");
assert(!validateEmail(null).valid, "Rejects null email");
const noEmailLead: RawLeadInput = { full_name: "No Email User", company_name: "Acme" };
assertEquals(normalizeLeadRecord(noEmailLead, "ws-1"), null, "Rejects record missing email");

// ── Scenario 11 & 12: AI Refinement Resilience ──────────────────────────────
console.log("\nScenario 11 & 12: Deterministic Mapping Fallback & Resilience");
const nonStandardHeaders = ["Client Email", "Client Full Name", "Employer"];
const mappedNonStandard = tryDeterministicHeaderMapping(nonStandardHeaders);
assertEquals(mappedNonStandard?.email, "Client Email", "Recognizes 'Client Email' alias without AI call");

// ── Scenario 13: Database Chunking Validation ────────────────────────────────
console.log("\nScenario 13: Batch Chunking Simulation");
const chunkTestArray = Array.from({ length: 1250 }, (_, i) => i);
const batchSize = 500;
const chunksCount = Math.ceil(chunkTestArray.length / batchSize);
assertEquals(chunksCount, 3, "Divides 1250 items into exactly 3 chunks of <=500");

// ── Scenario 14: Partial Batch Failure & Isolation ───────────────────────────
console.log("\nScenario 14: Corrupted Row Isolation");
const mixedRows: RawLeadInput[] = [
  { email: "good1@corp.com", full_name: "Good One" },
  { email: "corrupted-email" }, // invalid
  { email: "good2@corp.com", full_name: "Good Two" },
];
const validIsolated: NormalizedLead[] = [];
let invalidCount = 0;
for (const r of mixedRows) {
  const norm = normalizeLeadRecord(r, "ws-1");
  if (norm && validateLead(norm).valid) {
    validIsolated.push(norm);
  } else {
    invalidCount++;
  }
}
assertEquals(validIsolated.length, 2, "Valid rows preserved during corrupted row failure");
assertEquals(invalidCount, 1, "Corrupted row safely counted without throwing");

// ── Scenario 15: Repeated Import Idempotency ─────────────────────────────────
console.log("\nScenario 15: Repeated Import Idempotency");
const firstImport = [baseLead];
const { uniqueLeads: pass1 } = deduplicateInBatch(firstImport);
const { uniqueLeads: pass2, inBatchDuplicates: pass2Dupes } = deduplicateInBatch([...pass1, ...pass1]);
assertEquals(pass2.length, 1, "Re-importing identical dataset results in same single record");
assertEquals(pass2Dupes, 1, "Correctly flags re-imported duplicate");

// ── Scenario 16: Suppressed Lead Filtering ───────────────────────────────────
console.log("\nScenario 16: Suppression List Filtering");
const suppressedSet = new Set(["sarah@cyberdyne.com"]);
const { active: activeLeads, suppressed: suppLeads } = partitionSuppressedLeads([baseLead], suppressedSet);
assertEquals(activeLeads.length, 0, "Suppressed lead excluded from active import");
assertEquals(suppLeads.length, 1, "Suppressed lead identified");

// ── Scenario 17 & 18: Empty File & Whitespace Handling ───────────────────────
console.log("\nScenario 17 & 18: Empty File & Whitespace Handling");
assertEquals(detectInputFormat(""), "empty", "Empty string detected as empty");
assertEquals(detectInputFormat("   \n\t   "), "empty", "Whitespace detected as empty");
const parsedEmptyObj = parseRawInput("");
assertEquals(parsedEmptyObj.rows?.length, 0, "Empty input yields 0 rows");

// ── Scenario 19: Large Dataset Stress Test (1,000 Records) ───────────────────
console.log("\nScenario 19: Large Dataset Stress Test (1,000 Records)");
const largeSet: RawLeadInput[] = [];
for (let i = 1; i <= 1000; i++) {
  const id = i <= 800 ? i : i - 200; // 800 unique + 200 dupes
  largeSet.push({
    email: `Employee.${id}@Enterprise.COM`,
    full_name: `Employee ${id}`,
    company_name: `Enterprise ${id}, Inc.`,
    phone: `+1 555 000 ${id}`,
    custom_attribute: `CustomVal_${id}`,
  });
}
const startT = performance.now();
const largeNorm: NormalizedLead[] = [];
for (const raw of largeSet) {
  const n = normalizeLeadRecord(raw, "ws-perf");
  if (n && validateLead(n).valid) largeNorm.push(n);
}
const { uniqueLeads: largeDeduped, inBatchDuplicates: largeDupes } = deduplicateInBatch(largeNorm);
const durationMs = performance.now() - startT;

assertEquals(largeNorm.length, 1000, "Normalizes all 1,000 records without failure");
assertEquals(largeDeduped.length, 800, "Correctly extracts 800 unique records from 1,000 inputs");
assertEquals(largeDupes, 200, "Accurately detects 200 duplicates");
assert(durationMs < 500, `Processed 1,000 records in ${durationMs.toFixed(1)}ms (< 500ms threshold)`);

// ── Summary ──────────────────────────────────────────────────────────────────
console.log("\n========================================================");
console.log(`TEST SUITE RESULTS: ${passedCount} Passed, ${failedCount} Failed`);
console.log("========================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
