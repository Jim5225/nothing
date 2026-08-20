"use server";

import { refineLeadInputWithAI } from "@/lib/leads/ai-refiner";
import { detectInputFormat } from "@/lib/leads/parser";
import { RawLeadInput } from "@/lib/leads/lead-types";

export async function extractLeadsWithAI(
  rawText: string
): Promise<{ success: boolean; data?: RawLeadInput[]; error?: string }> {
  if (!rawText || !rawText.trim()) {
    return { success: false, error: "Input text is empty." };
  }

  const format = detectInputFormat(rawText);
  return refineLeadInputWithAI(rawText, format);
}
