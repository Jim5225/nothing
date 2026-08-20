export const SUPPORTED_VARIABLES = [
  "first_name",
  "last_name",
  "full_name",
  "company_name",
  "job_title",
  "website",
  "booking_link",
  "sender_name",
  "sender_email",
] as const;

export type TemplateVariable = (typeof SUPPORTED_VARIABLES)[number];

export function renderTemplate(
  template: string,
  variables: Partial<Record<TemplateVariable, string | null>>
): string {
  if (!template) return "";

  // Replace variables using regex matching {{variable_name}}
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, variable) => {
    // Reject unsupported variables
    if (!SUPPORTED_VARIABLES.includes(variable as TemplateVariable)) {
      return match; // Keep it as is if unsupported
    }

    const value = variables[variable as TemplateVariable];
    
    // Safely handle missing values (prevent "undefined" or "null")
    if (value === undefined || value === null || value.trim() === "") {
      // Small context-aware fallback logic for missing names
      if (variable === "first_name" || variable === "full_name") {
        return "there";
      }
      return "";
    }

    return value;
  });
}
