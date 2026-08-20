import { GoogleGenerativeAI } from "@google/generative-ai";
import { RawLeadInput } from "./lead-types";
import { chunkText, parseCSVText, parseMarkdownTable } from "./parser";

const CANDIDATE_MODELS = ["gemini-2.5-flash", "gemini-1.5-flash"];

// Standard recognized header aliases for 100% deterministic mapping
const HEADER_ALIASES: Record<string, string[]> = {
  email: ["email", "email_address", "email address", "e-mail", "work email", "contact email", "primary email"],
  first_name: ["first_name", "firstname", "first name", "given name"],
  last_name: ["last_name", "lastname", "last name", "surname", "family name"],
  full_name: ["name", "full_name", "full name", "contact name", "lead name"],
  company_name: ["company", "company_name", "company name", "organization", "org", "business", "company_title"],
  job_title: ["title", "job_title", "job title", "position", "role", "designation"],
  website_url: ["website", "website_url", "url", "domain", "web", "site"],
  linkedin_url: ["linkedin", "linkedin_url", "linkedin profile", "linkedin url"],
  phone: ["phone", "phone number", "mobile", "cell", "telephone", "tel"],
  location: ["location", "city", "country", "address", "state"],
  industry: ["industry", "sector", "vertical"],
};

/**
 * Attempts 100% deterministic column header mapping without AI.
 */
export function tryDeterministicHeaderMapping(headers: string[]): Record<string, string> | null {
  const mapping: Record<string, string> = {};
  const lowerHeaderMap = new Map<string, string>();

  headers.forEach((h) => {
    if (h && h.trim()) {
      lowerHeaderMap.set(h.trim().toLowerCase(), h);
    }
  });

  for (const [targetKey, aliases] of Object.entries(HEADER_ALIASES)) {
    // 1. Check exact aliases
    for (const alias of aliases) {
      if (lowerHeaderMap.has(alias) && !mapping[targetKey]) {
        mapping[targetKey] = lowerHeaderMap.get(alias)!;
        break;
      }
    }
  }

  // 2. Fallback for compound email header if not found (e.g. "Client Email", "Subscriber Email")
  if (!mapping.email) {
    for (const [rawLower, original] of lowerHeaderMap.entries()) {
      if (rawLower.includes("email") || rawLower.includes("e-mail")) {
        mapping.email = original;
        break;
      }
    }
  }

  // If email was matched, we have a valid deterministic mapping!
  return mapping.email ? mapping : null;
}

/**
 * Invokes Gemini with retry and candidate fallback models.
 */
async function callGeminiWithRetry(prompt: string, maxRetries = 2): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  let lastError: Error | null = null;
  const genAI = new GoogleGenerativeAI(apiKey);

  for (const modelName of CANDIDATE_MODELS) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0,
          },
        });

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        if (text && text.trim()) {
          return text;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Exponential backoff if not last attempt
        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 200, 4000);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
  }

  throw lastError || new Error("Gemini AI extraction failed across all models.");
}

/**
 * Strict Anti-Hallucination Filter: Discards any extracted email not rooted in the source text.
 */
function verifyExtractedLeads(extracted: RawLeadInput[], sourceChunk: string): RawLeadInput[] {
  const lowerSource = sourceChunk.toLowerCase();

  return extracted.filter((lead) => {
    if (!lead || typeof lead !== "object") return false;
    if (!lead.email || typeof lead.email !== "string") return false;

    const email = lead.email.trim().toLowerCase();
    if (!email.includes("@")) return false;

    const [user, domain] = email.split("@");
    const emailPresent = lowerSource.includes(email) || (lowerSource.includes(user) && lowerSource.includes(domain));

    if (!emailPresent) {
      console.warn(`[Anti-Hallucination] Discarding invented email: ${email}`);
      return false;
    }

    return true;
  });
}

/**
 * Extracts leads from unstructured text using Gemini AI with strict anti-hallucination rules.
 */
export async function extractLeadsFromChunk(chunk: string): Promise<RawLeadInput[]> {
  const prompt = `You are a strict data extraction engine.
TASK: Extract all real contact/lead information found in the text below.

STRICT ANTI-HALLUCINATION RULES:
1. NEVER invent, guess, hallucinate, or extrapolate any information not explicitly present in the input text.
2. NEVER infer or guess a person's name (first_name, last_name) or company_name from their email address or domain. If the name or company is not written explicitly in the text alongside the email, leave it null.
3. If a contact does not have a phone number, company, job title, or location explicitly stated in the text, set that field to null.
4. NEVER generate placeholder or fake emails (e.g. test@example.com, user@domain.com).
5. Only extract contacts that have an actual email address present in the text.
6. If the same person has multiple attributes, group them into a single object.

Output format:
Return ONLY a valid JSON array of objects with the following keys:
- email (string, required)
- first_name (string | null)
- last_name (string | null)
- full_name (string | null)
- company_name (string | null)
- job_title (string | null)
- phone (string | null)
- website_url (string | null)
- linkedin_url (string | null)
- location (string | null)
- industry (string | null)

Input Text:
${chunk}
`;

  const rawJson = await callGeminiWithRetry(prompt);
  const cleaned = rawJson.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return verifyExtractedLeads(parsed, chunk);
}

/**
 * AI Schema Discovery for ambiguous CSV / Markdown headers.
 */
export async function discoverTableSchemaWithAI(sampleRows: Record<string, string>[]): Promise<Record<string, string>> {
  if (sampleRows.length === 0) return {};

  const headers = Object.keys(sampleRows[0]);
  const sampleData = sampleRows.slice(0, 5);

  const prompt = `You are a schema matching assistant.
Match the input column headers to our target lead fields.

Target Fields:
- email (Email address - REQUIRED)
- first_name (First name)
- last_name (Last name)
- full_name (Full name / Contact name)
- company_name (Company / Organization / Business name)
- job_title (Job Title / Position / Role)
- phone (Phone / Mobile / Telephone)
- website_url (Website / Domain / URL)
- linkedin_url (LinkedIn profile or company page)
- location (City, State, Country, or Full Address)
- industry (Industry / Sector / Category)

Headers present in the file:
${JSON.stringify(headers)}

Sample rows:
${JSON.stringify(sampleData)}

Return ONLY a valid JSON object mapping our target field key to the exact header name from the file.
Example: {"email": "Work Email", "full_name": "Contact Name", "company_name": "Organization"}
Only include keys where a matching column exists in the headers. Do not invent column names.`;

  try {
    const rawJson = await callGeminiWithRetry(prompt, 1);
    const cleaned = rawJson.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const mapping = JSON.parse(cleaned);
    return typeof mapping === "object" && mapping !== null ? mapping : {};
  } catch (error) {
    console.warn("[Schema Discovery] Error discovering schema:", error);
    return {};
  }
}

/**
 * Unified Refiner:
 * 1. If structured table -> Try deterministic mapping (0 AI cost, 0 latency).
 * 2. If ambiguous table -> AI schema discovery on 5 sample rows -> Fast deterministic stream.
 * 3. If unstructured text -> Chunked Gemini AI extraction with anti-hallucination guard.
 */
export async function refineLeadInputWithAI(
  rawText: string,
  format: string
): Promise<{ success: boolean; data?: RawLeadInput[]; error?: string }> {
  try {
    if (!rawText || !rawText.trim()) {
      return { success: false, error: "Input text is empty." };
    }

    // Step 1: Structured CSV / Markdown handling
    if (format === "csv" || format === "markdown") {
      const rows = format === "csv" ? parseCSVText(rawText) : parseMarkdownTable(rawText);

      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);

        // A. Try deterministic mapping first (NO AI needed!)
        let schemaMap = tryDeterministicHeaderMapping(headers);

        // B. If ambiguous, ask AI to map sample headers once
        if (!schemaMap) {
          schemaMap = await discoverTableSchemaWithAI(rows);
        }

        if (schemaMap && schemaMap.email) {
          const mappedLeads: RawLeadInput[] = rows.map((row) => ({
            email: row[schemaMap.email] || null,
            first_name: schemaMap.first_name ? row[schemaMap.first_name] : null,
            last_name: schemaMap.last_name ? row[schemaMap.last_name] : null,
            full_name: schemaMap.full_name ? row[schemaMap.full_name] : null,
            company_name: schemaMap.company_name ? row[schemaMap.company_name] : null,
            job_title: schemaMap.job_title ? row[schemaMap.job_title] : null,
            phone: schemaMap.phone ? row[schemaMap.phone] : null,
            website_url: schemaMap.website_url ? row[schemaMap.website_url] : null,
            linkedin_url: schemaMap.linkedin_url ? row[schemaMap.linkedin_url] : null,
            location: schemaMap.location ? row[schemaMap.location] : null,
            industry: schemaMap.industry ? row[schemaMap.industry] : null,
            custom_fields: { ...row }, // Preserve all original unmapped fields
          }));

          return { success: true, data: mappedLeads };
        }
      }
    }

    // Step 2: Unstructured Text handling via Chunked Gemini Extraction
    const chunks = chunkText(rawText, 25000);
    const allLeads: RawLeadInput[] = [];

    for (const chunk of chunks) {
      const chunkLeads = await extractLeadsFromChunk(chunk);
      allLeads.push(...chunkLeads);
    }

    return { success: true, data: allLeads };
  } catch (error) {
    console.error("[Refine Lead Input Error]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to refine lead input with AI",
    };
  }
}
