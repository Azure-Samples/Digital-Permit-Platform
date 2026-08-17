function decodeSafely(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function containsTraversal(value: string): boolean {
  // Reject the raw and percent-decoded forms of `..` and backslash.
  const normalised = decodeSafely(decodeSafely(value)).toLowerCase();
  if (
    normalised.includes("..") ||
    normalised.includes("\\") ||
    normalised.includes("\0")
  ) {
    return true;
  }
  for (let index = 0; index < normalised.length; index += 1) {
    if (normalised.charCodeAt(index) < 0x20) return true;
  }
  return false;
}

export function safeRelativeCallbackUrl(
  value: string | null,
  fallback: string,
): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (containsTraversal(value)) return fallback;

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
    if (destination.origin !== base.origin) return baseUrl;
    if (containsTraversal(destination.pathname)) return baseUrl;
    return destination.toString();
  } catch {
    return baseUrl;
  }
}