// ─────────────────────────────────────────────────────────────
// External API key generation and hashing
// ─────────────────────────────────────────────────────────────
// A key looks like:  dpp_live_<12-hex-prefix>_<43-char-secret>
// Only the public prefix and the SHA-256 hash of the whole key are
// persisted. The plaintext secret is returned to the caller once and
// is never stored or logged.
// ─────────────────────────────────────────────────────────────
import { createHash, randomBytes } from "node:crypto";

const KEY_NAMESPACE = "dpp_live_";
const PREFIX_TOKEN_BYTES = 6; // 12 hex characters
const SECRET_BYTES = 32; // 43 base64url characters

export interface GeneratedApiKey {
  /** The full secret, shown to the administrator exactly once. */
  plaintext: string;
  /** Public, non-secret identifier that is safe to store and display. */
  keyPrefix: string;
  /** SHA-256 hash of the plaintext; the only secret-derived value stored. */
  keyHash: string;
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export function generateApiKey(): GeneratedApiKey {
  const prefixToken = randomBytes(PREFIX_TOKEN_BYTES).toString("hex");
  const secret = randomBytes(SECRET_BYTES).toString("base64url");
  const keyPrefix = `${KEY_NAMESPACE}${prefixToken}`;
  const plaintext = `${keyPrefix}_${secret}`;
  return { plaintext, keyPrefix, keyHash: hashApiKey(plaintext) };
}

/** Extract the public prefix from a supplied key without trusting the rest. */
export function keyPrefixFromPlaintext(plaintext: string): string | null {
  const match = plaintext.match(/^(dpp_live_[a-f0-9]{12})_/);
  return match ? match[1] : null;
}
