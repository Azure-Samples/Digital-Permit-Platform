// ─────────────────────────────────────────────────────────────
// Extract applicant display name from application answers
// ─────────────────────────────────────────────────────────────

/**
 * Extract the applicant's name from their form answers.
 * Searches common field keys across sections.
 * Falls back to the User account name if nothing found in answers.
 */
export function getApplicantDisplayName(
  answers: Record<string, unknown> | null | undefined,
  fallbackFirstName?: string,
  fallbackLastName?: string
): string {
  if (!answers || typeof answers !== "object") {
    return [fallbackFirstName, fallbackLastName].filter(Boolean).join(" ") || "Unknown";
  }

  // Flatten all section answers into one object
  const flat: Record<string, unknown> = {};
  for (const [, sectionVal] of Object.entries(answers)) {
    if (typeof sectionVal === "object" && sectionVal !== null && !Array.isArray(sectionVal)) {
      Object.assign(flat, sectionVal);
    }
  }

  // Try common field key patterns for name
  const firstName =
    asStr(flat["first_name"]) ||
    asStr(flat["firstName"]) ||
    asStr(flat["forename"]) ||
    "";
  const lastName =
    asStr(flat["last_name"]) ||
    asStr(flat["lastName"]) ||
    asStr(flat["surname"]) ||
    "";
  const fullName =
    asStr(flat["name"]) ||
    asStr(flat["full_name"]) ||
    asStr(flat["fullName"]) ||
    asStr(flat["applicant_name"]) ||
    "";

  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(" ");
  }

  if (fullName) {
    return fullName;
  }

  // Fallback to user account
  return [fallbackFirstName, fallbackLastName].filter(Boolean).join(" ") || "Unknown";
}

function asStr(val: unknown): string {
  if (typeof val === "string" && val.trim()) return val.trim();
  return "";
}
