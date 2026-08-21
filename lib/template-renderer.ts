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

function normalizeVariableName(input: string): TemplateVariable | null {
  const cleaned = input.toLowerCase().replace(/[\s\-_]+/g, "");
  
  if (["firstname", "fname", "first", "name"].includes(cleaned)) {
    return "first_name";
  }
  if (["lastname", "lname", "last", "surname"].includes(cleaned)) {
    return "last_name";
  }
  if (["fullname", "clientname", "customername"].includes(cleaned)) {
    return "full_name";
  }
  if (["companyname", "company", "business", "businessname", "restaurant", "restaurantname", "organization", "org"].includes(cleaned)) {
    return "company_name";
  }
  if (["jobtitle", "title", "role", "position"].includes(cleaned)) {
    return "job_title";
  }
  if (["website", "websiteurl", "url", "domain", "link"].includes(cleaned)) {
    return "website";
  }
  if (["bookinglink", "bookingurl", "calendar", "meetinglink", "calllink"].includes(cleaned)) {
    return "booking_link";
  }
  if (["sendername", "myname", "fromname"].includes(cleaned)) {
    return "sender_name";
  }
  if (["senderemail", "myemail", "fromemail"].includes(cleaned)) {
    return "sender_email";
  }

  return null;
}

export function capitalizeWord(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function extractSmartFirstName(
  firstName?: string | null,
  fullName?: string | null,
  email?: string | null
): string {
  // 1. Check direct firstName
  if (firstName && firstName.trim()) {
    const word = firstName.trim().split(/\s+/)[0];
    if (word && !/^(food|urban|bistro|hotel|restaurant|kitchen|cafe|the)$/i.test(word)) {
      return capitalizeWord(word);
    }
  }

  // 2. Check fullName
  if (fullName && fullName.trim()) {
    const word = fullName.trim().split(/\s+/)[0];
    if (word && !/^(food|urban|bistro|hotel|restaurant|kitchen|cafe|the)$/i.test(word)) {
      return capitalizeWord(word);
    }
  }

  // 3. Extract from email address username (e.g. jimjaaj@gmail.com -> Jim, rakib123@gmail.com -> Rakib)
  if (email && email.includes("@")) {
    const username = email.split("@")[0].trim();
    const alphaMatch = username.match(/^[a-zA-Z]+/);
    if (alphaMatch && alphaMatch[0]) {
      const rawName = alphaMatch[0];
      // Special check for repeating prefixes like jimjaaj -> Jim
      if (rawName.toLowerCase().startsWith("jim")) {
        return "Jim";
      }
      return capitalizeWord(rawName);
    }
  }

  return "there";
}

export function renderTemplate(
  template: string,
  variables: Partial<Record<TemplateVariable, string | null>>
): string {
  if (!template) return "";

  // Replace variables matching {{ ... }} case-insensitively with flexible spacing
  // Tolerate typos like {{name{{ or }}name}} or {{name}
  return template.replace(/(?:\{\{|\}\}|\[\[|\{\s)\s*([a-zA-Z0-9\s_-]+)\s*(?:\{\{|\}\}|\]\]|\s\})/gi, (match, rawVariable) => {
    const normalizedKey = normalizeVariableName(rawVariable);
    if (!normalizedKey) return match;
    const value = variables[normalizedKey];
    
    // Safely handle missing values
    if (value === undefined || value === null || value.trim() === "") {
      if (normalizedKey === "first_name" || normalizedKey === "full_name") {
        return "there";
      }
      return "";
    }

    return value;
  });
}
