import { GoogleGenerativeAI } from "@google/generative-ai";
import { RawLeadInput } from "./lead-types";
import { chunkText, parseCSVText, parseMarkdownTable } from "./parser";

const CANDIDATE_MODELS = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-1.5-flash"];

/**
 * Invokes Gemini with candidate fallback models.
 */
async function callGeminiWithFallback(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  let lastError: Error | null = null;
  const genAI = new GoogleGenerativeAI(apiKey);

  for (const modelName of CANDIDATE_MODELS) {
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
      console.warn(`[AI Refiner] Model ${modelName} failed, attempting fallback:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error("All Gemini models failed to generate a response.");
}

/**
 * Anti-hallucination validator: Checks that extracted emails and critical tokens
 * actually originated in the source text chunk.
 */
function verifyExtractedLeads(extracted: RawLeadInput[], sourceChunk: string): RawLeadInput[] {
  const lowerSource = sourceChunk.toLowerCase();

  return extracted.filter((lead) => {
    if (!lead || typeof lead !== "object") return false;
    if (!lead.email || typeof lead.email !== "string") return false;

    const email = lead.email.trim().toLowerCase();
    if (!email.includes("@")) return false;

    // Check if the domain or username exists in the source text to prevent AI hallucinations
    const [user, domain] = email.split("@");
    const emailPresent = lowerSource.includes(email) || (lowerSource.includes(user) && lowerSource.includes(domain));

    if (!emailPresent) {
      console.warn(`[Anti-Hallucination] Discarding hallucinated email not found in input: ${email}`);
      return false;
    }

    return true;
  });
}

/**
 * Extracts leads from an unstructured or semi-structured text chunk using Gemini AI.
 */
export async function extractLeadsFromChunk(chunk: string): Promise<RawLeadInput[]> {
  const prompt = `You are a strict data extraction engine.
TASK: Extract all real contact/lead information found in the text below.

STRICT ANTI-HALLUCINATION RULES:
1. NEVER invent, guess, hallucinate, or extrapolate any information not explicitly present in the input text.
2. If a contact does not have a phone number, company, job title, or location in the text, set that field to null.
3. NEVER generate placeholder or fake emails (e.g. test@example.com, user@domain.com).
4. Only extract contacts that have an actual email address present in the text.
5. If the same person has multiple attributes, group them into a single object.

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

  const rawJson = await callGeminiWithFallback(prompt);
  const cleaned = rawJson.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return verifyExtractedLeads(parsed, chunk);
}

/**
 * Discovers column mapping for structured CSV/Markdown tables using Gemini AI.
 */
export async function discoverTableSchemaWithAI(sampleRows: Record<string, string>[]): Promise<Record<string, string>> {
  if (sampleRows.length === 0) return {};

  const headers = Object.keys(sampleRows[0]);
  const sampleData = sampleRows.slice(0, 5);

  const prompt = `You are a database schema matching assistant.
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
    const rawJson = await callGeminiWithFallback(prompt);
    const cleaned = rawJson.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const mapping = JSON.parse(cleaned);
    return typeof mapping === "object" && mapping !== null ? mapping : {};
  } catch (error) {
    console.warn("[Schema Discovery] Fallback to heuristic mapping due to error:", error);
    return {};
  }
}

/**
 * High-performance AI Refinement Pipeline:
 * - Structured large files: Samples schema with AI -> fast streams all rows -> zero token waste!
 * - Unstructured text: Chunks & extracts concurrently with Gemini AI.
 */
export async function refineLeadInputWithAI(
  rawText: string,
  format: string
): Promise<{ success: boolean; data?: RawLeadInput[]; error?: string }> {
  try {
    if (!rawText || !rawText.trim()) {
      return { success: false, error: "Input text is empty." };
    }

    // Fast-path for large structured CSV or Markdown
    if (format === "csv" || format === "markdown") {
      const rows = format === "csv" ? parseCSVText(rawText) : parseMarkdownTable(rawText);

      if (rows.length > 0) {
        // Sample schema with AI
        const schemaMap = await discoverTableSchemaWithAI(rows);

        // If AI found an email mapping, map all rows directly
        if (schemaMap.email && Object.keys(schemaMap).length > 0) {
          const mappedLeads: RawLeadInput[] = rows.map((row) => {
            const lead: RawLeadInput = {
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
            };
            return lead;
          });

          return { success: true, data: mappedLeads };
        }
      }
    }

    // For unstructured text or if schema discovery found no email column:
    // Chunk input and process through Gemini AI extraction
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
