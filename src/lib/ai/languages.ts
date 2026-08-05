// ─────────────────────────────────────────────────────────────
// Client-safe language list for the applicant assistant.
// Kept free of server imports so it can be used in client
// components (language selector) and on the server (prompts).
// ─────────────────────────────────────────────────────────────

export interface AssistantLanguage {
  code: string;
  name: string; // English name used in prompts
  label: string; // native label shown in the UI
  rtl?: boolean;
}

export const SUPPORTED_LANGUAGES: AssistantLanguage[] = [
  { code: "en", name: "English", label: "English" },
  { code: "bn", name: "Bengali", label: "বাংলা" },
  { code: "pl", name: "Polish", label: "Polski" },
  { code: "ur", name: "Urdu", label: "اردو", rtl: true },
  { code: "ro", name: "Romanian", label: "Română" },
  { code: "pt", name: "Portuguese", label: "Português" },
  { code: "gu", name: "Gujarati", label: "ગુજરાતી" },
  { code: "pa", name: "Punjabi", label: "ਪੰਜਾਬੀ" },
  { code: "zh", name: "Simplified Chinese", label: "中文" },
  { code: "cy", name: "Welsh", label: "Cymraeg" },
];

export function languageName(code: string): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name || "English";
}

export function isRtl(code: string): boolean {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.rtl ?? false;
}
