/**
 * RFC 6266 Content-Disposition helpers.
 *
 * `filename=` in Content-Disposition is a "quoted-string" whose value cannot
 * safely contain quotes, backslashes, or control characters. `filename*=` uses
 * RFC 5987 percent-encoding and is the safe form for user-supplied names.
 */

const FALLBACK_FILENAME = "download";

function sanitiseAsciiFallback(name: string): string {
  const stripped = name
    .replace(/[\r\n\t\v\f\0]/g, "")
    .replace(/[\\"]/g, "_")
    .replace(/[^\x20-\x7e]/g, "_")
    .trim();
  const bounded = stripped.slice(0, 200);
  return bounded.length > 0 ? bounded : FALLBACK_FILENAME;
}

function safeFilename(filename: string | null | undefined): string {
  if (typeof filename !== "string" || filename.length === 0) {
    return FALLBACK_FILENAME;
  }
  return filename.length > 512 ? filename.slice(0, 512) : filename;
}

export function contentDispositionHeader(
  disposition: "attachment" | "inline",
  filename: string | null | undefined,
): string {
  const value = safeFilename(filename);
  const asciiFallback = sanitiseAsciiFallback(value);
  const encoded = encodeURIComponent(value);
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
