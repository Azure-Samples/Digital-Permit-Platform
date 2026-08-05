// ─────────────────────────────────────────────────────────────
// Azure OpenAI client for the Licensing Portal
// ─────────────────────────────────────────────────────────────
// Uses Microsoft Entra ID (DefaultAzureCredential) when an Azure
// OpenAI endpoint is configured with local auth disabled, otherwise
// falls back to a plain OpenAI API key.
// ─────────────────────────────────────────────────────────────
import OpenAI from "openai";
import { DefaultAzureCredential } from "@azure/identity";

let client: OpenAI | null = null;

/** The chat model / Azure deployment name to call. */
export const AI_MODEL =
  process.env.AZURE_OPENAI_DEPLOYMENT ||
  process.env.OPENAI_MODEL ||
  "gpt-4.1-mini";

/** Whether any AI backend is configured. Lets the UI degrade gracefully. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.AZURE_OPENAI_ENDPOINT || process.env.OPENAI_API_KEY);
}

export function getOpenAI(): OpenAI {
  if (client) return client;

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;

  if (endpoint) {
    // Azure OpenAI via Entra ID token (resource has disableLocalAuth=true).
    const credential = new DefaultAzureCredential();
    const scope = "https://cognitiveservices.azure.com/.default";
    const base = endpoint.endsWith("/") ? endpoint : `${endpoint}/`;

    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "placeholder", // overridden per-request
      baseURL: `${base}openai/deployments/${AI_MODEL}`,
      defaultQuery: {
        "api-version": process.env.AZURE_OPENAI_API_VERSION || "2024-10-21",
      },
      fetch: async (url, init) => {
        const token = await credential.getToken(scope);
        const headers = new Headers(init?.headers);
        headers.set("Authorization", `Bearer ${token.token}`);
        headers.delete("api-key");
        return fetch(url as any, { ...init, headers });
      },
    });
  } else {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return client;
}
