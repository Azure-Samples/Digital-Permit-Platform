// ─────────────────────────────────────────────────────────────
// External API scopes
// ─────────────────────────────────────────────────────────────
// Coarse-grained, read-only scopes granted to machine-to-machine
// API clients. Each /api/v1 endpoint requires exactly one scope.
// ─────────────────────────────────────────────────────────────

export const API_SCOPES = [
  "applications:read",
  "modules:read",
  "policies:read",
  "statistics:read",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export const API_SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  "applications:read":
    "Read licence and permit applications, including status, workflow stage and decisions.",
  "modules:read": "Read the catalogue of licence and permit types (modules).",
  "policies:read": "Read active licensing policy metadata for each regime.",
  "statistics:read": "Read aggregate counts of applications by status and module.",
};

export function isApiScope(value: unknown): value is ApiScope {
  return typeof value === "string" && API_SCOPES.includes(value as ApiScope);
}

export function normaliseScopes(values: unknown): ApiScope[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<ApiScope>();
  for (const value of values) {
    if (isApiScope(value)) seen.add(value);
  }
  return [...seen];
}
