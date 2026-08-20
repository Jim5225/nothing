import Papa from "papaparse";
import { InputFormatType, RawLeadInput } from "./lead-types";

/**
 * Detects the format of raw input data.
 */
export function detectInputFormat(text: string): InputFormatType {
  const trimmed = text.trim();
  if (!trimmed) return "empty";

  // Check JSON
  if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) || typeof parsed === "object") {
        return "json";
      }
    } catch {
      // Fall through
    }
  }

  // Check Markdown Table
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  const pipeLines = lines.filter((l) => l.includes("|"));
  const hasDivider = lines.some((l) => /^\|?[\s-:|]+\|?$/.test(l));

  if (pipeLines.length >= 2 && (hasDivider || pipeLines.length === lines.length)) {
    return "markdown";
  }

  // Check CSV/TSV
  if (lines.length >= 1) {
    const firstLine = lines[0];
    const commas = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;

    if (commas >= 1 || semicolons >= 1 || tabs >= 1) {
      return "csv";
    }
  }

  return "unstructured_text";
}

/**
 * Parses markdown table text into structured key-value rows.
 */
export function parseMarkdownTable(text: string): Record<string, string>[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^\|?[\s-:|]+\|?$/.test(l)) // Remove markdown divider like |---|---|---|
    .map((l) => {
      let cleaned = l;
      if (cleaned.startsWith("|")) cleaned = cleaned.substring(1);
      if (cleaned.endsWith("|")) cleaned = cleaned.substring(0, cleaned.length - 1);
      return cleaned.trim();
    });

  const cleanedText = lines.join("\n");
  const parsed = Papa.parse<Record<string, string>>(cleanedText, {
    header: true,
    delimiter: "|",
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().replace(/^["']+|["']+$/g, "").trim(),
    transform: (v) => (typeof v === "string" ? v.trim().replace(/^["']+|["']+$/g, "").trim() : v),
  });

  return (parsed.data || []).map((row) => {
    const cleanRow: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      const cleanKey = k ? k.trim().replace(/^["']+|["']+$/g, "").trim() : "";
      if (cleanKey) {
        cleanRow[cleanKey] = typeof v === "string" ? v.trim().replace(/^["']+|["']+$/g, "").trim() : String(v || "");
      }
    }
    return cleanRow;
  });
}

/**
 * Parses CSV/TSV text into structured key-value rows.
 */
export function parseCSVText(text: string): Record<string, string>[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().replace(/^["']+|["']+$/g, "").trim(),
    transform: (v) => (typeof v === "string" ? v.trim().replace(/^["']+|["']+$/g, "").trim() : v),
  });

  return (parsed.data || []).map((row) => {
    const cleanRow: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      const cleanKey = k ? k.trim().replace(/^["']+|["']+$/g, "").trim() : "";
      if (cleanKey) {
        cleanRow[cleanKey] = typeof v === "string" ? v.trim().replace(/^["']+|["']+$/g, "").trim() : String(v || "");
      }
    }
    return cleanRow;
  });
}

/**
 * Parses raw text input into raw lead candidate records.
 */
export function parseRawInput(text: string): {
  format: InputFormatType;
  rows?: RawLeadInput[];
  rawText?: string;
} {
  const format = detectInputFormat(text);

  if (format === "empty") {
    return { format: "empty", rows: [] };
  }

  if (format === "json") {
    try {
      const parsed = JSON.parse(text.trim());
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      return { format: "json", rows };
    } catch {
      return { format: "unstructured_text", rawText: text };
    }
  }

  if (format === "markdown") {
    const rows = parseMarkdownTable(text);
    return { format: "markdown", rows };
  }

  if (format === "csv") {
    const rows = parseCSVText(text);
    return { format: "csv", rows };
  }

  return { format: "unstructured_text", rawText: text };
}

/**
 * Chunks text safely at newline boundaries for AI extraction.
 */
export function chunkText(text: string, maxChunkChars = 30000): string[] {
  if (text.length <= maxChunkChars) return [text];

  const lines = text.split("\n");
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (const line of lines) {
    if (currentLength + line.length + 1 > maxChunkChars && currentChunk.length > 0) {
      chunks.push(currentChunk.join("\n"));
      currentChunk = [];
      currentLength = 0;
    }
    currentChunk.push(line);
    currentLength += line.length + 1;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n"));
  }

  return chunks;
}
