// ─────────────────────────────────────────────────────────────
// Reference number generator
// ─────────────────────────────────────────────────────────────

/**
 * Generate a human-readable reference number.
 * Format: DP-{MODULE_PREFIX}-{YEAR}{MONTH}-{SEQUENCE}
 * Example: DP-TDN-202603-00042
 */
export function generateReferenceNumber(
  moduleKey: string,
  sequence: number,
  now: Date = new Date()
): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = moduleKey
    .split("_")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 4);
  const seq = String(sequence).padStart(5, "0");

  return `DP-${prefix}-${year}${month}-${seq}`;
}
