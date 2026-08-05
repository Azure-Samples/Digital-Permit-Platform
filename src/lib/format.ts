// ─────────────────────────────────────────────────────────────
// Display formatting utilities for form answers
// ─────────────────────────────────────────────────────────────

/**
 * Format a value for human-readable display based on its content.
 */
export function formatAnswerValue(value: unknown, _fieldKey?: string): string {
  if (value === null || value === undefined || value === "") return "—";

  // Boolean
  if (typeof value === "boolean") return value ? "Yes" : "No";

  // Address object
  if (isAddressObject(value)) return formatAddress(value as Record<string, string>);

  // Array of objects (repeatable sections)
  if (Array.isArray(value)) {
    return value
      .map((item, _i) => {
        if (typeof item === "object" && item !== null) {
          return Object.entries(item)
            .filter(([, v]) => v !== null && v !== undefined && v !== "")
            .map(([k, v]) => `${humaniseKey(k)}: ${formatAnswerValue(v)}`)
            .join(", ");
        }
        return String(item);
      })
      .join(" | ");
  }

  // String values
  if (typeof value === "string") {
    // Date string (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDateDDMMYYYY(value);

    // ISO datetime
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateDDMMYYYY(value.split("T")[0]);

    // Enum-like value (snake_case or contains underscore)
    if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(value)) return humaniseEnum(value);

    return value;
  }

  // Number
  if (typeof value === "number") return String(value);

  // Generic object – try to format nicely
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const entries = Object.entries(obj).filter(
      ([, v]) => v !== null && v !== undefined && v !== ""
    );
    if (entries.length === 0) return "—";
    return entries
      .map(([k, v]) => `${humaniseKey(k)}: ${formatAnswerValue(v)}`)
      .join(", ");
  }

  return String(value);
}

/**
 * Check if a value looks like an address object.
 */
function isAddressObject(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  const addressKeys = ["line1", "line2", "town", "city", "county", "postcode"];
  return addressKeys.some((k) => keys.includes(k));
}

/**
 * Format an address object into a readable string.
 */
function formatAddress(addr: Record<string, string>): string {
  const parts = [
    addr.line1,
    addr.line2,
    addr.town || addr.city,
    addr.county,
    addr.postcode?.toUpperCase(),
  ].filter(Boolean);
  return parts.join(", ");
}

/**
 * Format a YYYY-MM-DD date string to DD/MM/YYYY.
 */
export function formatDateDDMMYYYY(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

/**
 * Parse a DD/MM/YYYY string to YYYY-MM-DD for storage.
 */
export function parseDateToISO(ddmmyyyy: string): string {
  const parts = ddmmyyyy.split("/");
  if (parts.length !== 3) return ddmmyyyy;
  const [day, month, year] = parts;
  if (!day || !month || !year) return ddmmyyyy;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Convert a snake_case enum value to a human-readable label.
 * e.g. "yes_british" → "Yes – British citizen"
 */
function humaniseEnum(value: string): string {
  // Known specific mappings
  const KNOWN: Record<string, string> = {
    yes_british: "Yes – British citizen",
    yes_settled: "Yes – Settled status / indefinite leave",
    yes_visa: "Yes – Work visa",
    yes: "Yes",
    no: "No",
    individual: "Individual",
    partnership: "Partnership",
    limited_company: "Limited company",
    charity: "Charity",
    society: "Society",
    business: "Business",
    mr: "Mr",
    mrs: "Mrs",
    ms: "Ms",
    miss: "Miss",
    dr: "Dr",
    petrol: "Petrol",
    diesel: "Diesel",
    hybrid: "Hybrid",
    electric: "Electric",
    lpg: "LPG",
    on: "On the premises",
    off: "Off the premises",
    both: "Both on and off the premises",
    weekly: "Weekly",
    monthly: "Monthly",
    annual: "Annual",
    verified_public_page: "Verified – public page",
    verified_form_pack: "Verified – form pack",
    verified_policy: "Verified – policy",
    needs_council_confirmation: "Needs council confirmation",
  };

  if (KNOWN[value]) return KNOWN[value];

  // Generic: replace underscores with spaces, capitalise first word
  const words = value.split("_");
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(" ");
}

/**
 * Convert a camelCase or snake_case field key to a readable label.
 * e.g. "line1" → "Line 1", "postcode" → "Postcode"
 */
function humaniseKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/(\d+)/g, " $1")
    .trim();
}
