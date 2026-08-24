import { apiJson } from "@/lib/api/response";
import { API_SCOPE_DESCRIPTIONS, API_SCOPES } from "@/lib/api/scopes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public, unauthenticated discovery document describing the read-only API.
export function GET() {
  return apiJson({
    name: "Digital Permit Platform API",
    version: "v1",
    description:
      "Read-only API for downstream systems to query licensing and permit data. Authenticate with an Authorization: Bearer <key> header using an administrator-issued API key.",
    authentication: {
      scheme: "Bearer",
      header: "Authorization: Bearer <api-key>",
      notes:
        "API keys are issued and revoked by an administrator under Admin → API access. Keys are shown once at creation and cannot be recovered.",
    },
    scopes: API_SCOPES.map((scope) => ({
      scope,
      description: API_SCOPE_DESCRIPTIONS[scope],
    })),
    endpoints: [
      { method: "GET", path: "/api/v1/applications", scope: "applications:read" },
      {
        method: "GET",
        path: "/api/v1/applications/{reference}",
        scope: "applications:read",
      },
      { method: "GET", path: "/api/v1/modules", scope: "modules:read" },
      { method: "GET", path: "/api/v1/policies", scope: "policies:read" },
      { method: "GET", path: "/api/v1/statistics", scope: "statistics:read" },
    ],
  });
}
