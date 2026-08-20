"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

export async function extractLeadsWithAI(rawText: string) {
  if (!process.env.GEMINI_API_KEY) {
    return { success: false, error: "GEMINI_API_KEY is not configured on the server." };
  }

  const candidateModels = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-1.5-flash"];
  let lastError: Error | null = null;

  for (const modelName of candidateModels) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
        },
      });

      const prompt = `You are an expert lead data enrichment and verification AI.
Your task is to parse, clean, verify, and standardize the input data (which can be a CSV file, a markdown table, or unstructured contact text).

Instructions:
1. Identify all distinct individual contacts/leads.
2. For each contact, extract:
   - "email": Normalized lowercase valid email address (REQUIRED. Skip any row without a valid email).
   - "first_name": Proper capitalized first name (e.g. "John"). If only full name is available, split it.
   - "last_name": Proper capitalized last name (e.g. "Doe").
   - "company_name": Clean company/business name without trailing Inc/LLC if messy.
   - "job_title": Standardized job title (e.g. "Founder & CEO", "Marketing Director").
   - "website_url": Website or domain if available.
   - "linkedin_url": LinkedIn profile URL if available.
   - "phone": Standardized phone number if available.
   - "location": City/Country or address if available.
3. Clean and fix messy formatting, remove accidental quotes, stray delimiters, or broken characters.
4. Return ONLY a valid JSON array of objects.

Input Data:
${rawText.slice(0, 50000)}

Example Output Format:
[
  {
    "email": "sarah.connor@cyberdyne.com",
    "first_name": "Sarah",
    "last_name": "Connor",
    "company_name": "Cyberdyne Systems",
    "job_title": "Head of Operations",
    "location": "Los Angeles, CA"
  }
]`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      if (!responseText) {
        continue;
      }

      // Strip markdown code fences if present
      const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const leads = JSON.parse(cleaned);

      if (!Array.isArray(leads)) {
        continue;
      }

      const validLeads = leads
        .map((l: Record<string, string>) => {
          const email = (l.email || "").trim().toLowerCase();
          return {
            ...l,
            email,
            first_name: l.first_name ? l.first_name.trim() : "",
            last_name: l.last_name ? l.last_name.trim() : "",
            company_name: l.company_name ? l.company_name.trim() : "",
            job_title: l.job_title ? l.job_title.trim() : "",
            website_url: l.website_url ? l.website_url.trim() : "",
            linkedin_url: l.linkedin_url ? l.linkedin_url.trim() : "",
            phone: l.phone ? l.phone.trim() : "",
            location: l.location ? l.location.trim() : "",
          };
        })
        .filter((l) => l.email && l.email.includes("@") && l.email.includes("."));

      if (validLeads.length === 0) {
        return { success: false, error: "No valid email addresses found in the uploaded data." };
      }

      return { success: true, data: validLeads };
    } catch (error) {
      console.warn(`[AI Extraction] Model ${modelName} failed:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  return { 
    success: false, 
    error: `AI extraction failed: ${lastError?.message || "Unknown error"}` 
  };
}
