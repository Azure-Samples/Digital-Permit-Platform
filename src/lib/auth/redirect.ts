export function safeRelativeCallbackUrl(
  value: string | null,
  fallback: string,
): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const origin = "https://callback.invalid";
    const callback = new URL(value, origin);
    if (callback.origin !== origin) return fallback;
    return `${callback.pathname}${callback.search}${callback.hash}`;
  } catch {
    return fallback;
  }
}

export function safeAuthRedirect(url: string, baseUrl: string): string {
  try {
    const base = new URL(baseUrl);
    const destination = new URL(url, base);
    return destination.origin === base.origin ? destination.toString() : baseUrl;
  } catch {
    return baseUrl;
  }
}