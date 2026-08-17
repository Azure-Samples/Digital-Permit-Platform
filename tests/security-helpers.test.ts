import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertContentLength,
  assertSlug,
  assertUuid,
  fileSignatureMatchesMime,
} from "../src/lib/http/validation";
import {
  checkRateLimit,
  clearRateLimitsForTests,
  requestClientAddress,
} from "../src/lib/http/rate-limit";
import { safeRelativeCallbackUrl } from "../src/lib/auth/redirect";
import { contentDispositionHeader } from "../src/lib/http/content-disposition";

describe("assertUuid", () => {
  const validUuid = "5b220980-e167-4d35-a992-608fbcbdfeda";

  it("returns null for a well-formed UUID", () => {
    assert.equal(assertUuid(validUuid, "applicationId"), null);
  });

  it("returns 400 for non-string values", async () => {
    const response = assertUuid(undefined, "documentId");
    assert.ok(response);
    assert.equal(response!.status, 400);
    const body = await response!.json();
    assert.match(body.error, /documentId/);
  });

  it("returns 400 for malformed UUIDs, including SQL and path payloads", async () => {
    for (const bad of [
      "",
      "not-a-uuid",
      "5b220980-e167-4d35-a992-608fbcbdfeda' OR 1=1--",
      "../../etc/passwd",
      "5b220980_e167_4d35_a992_608fbcbdfeda",
    ]) {
      const response = assertUuid(bad, "policyId");
      assert.ok(response, `expected 400 for ${bad}`);
      assert.equal(response!.status, 400);
    }
  });
});

describe("assertSlug", () => {
  it("accepts simple bounded slugs", () => {
    for (const value of ["id_document", "proof-address", "cctv.plan1"]) {
      assert.equal(assertSlug(value, "requirementKey"), null);
    }
  });

  it("rejects traversal attempts and control characters", async () => {
    for (const bad of ["..", "../etc", "hello/world", "foo\\bar", "\0hidden", "a".repeat(65)]) {
      const response = assertSlug(bad, "requirementKey");
      assert.ok(response, `expected 400 for ${JSON.stringify(bad)}`);
      assert.equal(response!.status, 400);
    }
  });
});

describe("assertContentLength", () => {
  it("passes when the header is missing", () => {
    const request = new Request("http://localhost/x", { method: "POST" });
    assert.equal(assertContentLength(request, 1024), null);
  });

  it("passes when within the limit", () => {
    const request = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-length": "100" },
    });
    assert.equal(assertContentLength(request, 1024), null);
  });

  it("returns 413 when the header exceeds the limit", async () => {
    const request = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-length": String(50 * 1024 * 1024) },
    });
    const response = assertContentLength(request, 10 * 1024 * 1024);
    assert.ok(response);
    assert.equal(response!.status, 413);
  });

  it("returns 400 for a malformed header", async () => {
    const request = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-length": "not-a-number" },
    });
    const response = assertContentLength(request, 10 * 1024 * 1024);
    assert.ok(response);
    assert.equal(response!.status, 400);
  });
});

describe("fileSignatureMatchesMime", () => {
  it("accepts a valid PDF signature", () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);
    assert.equal(fileSignatureMatchesMime(pdf, "application/pdf"), true);
  });

  it("rejects a PDF signature masquerading as PNG", () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    assert.equal(fileSignatureMatchesMime(pdf, "image/png"), false);
  });

  it("accepts a valid PNG signature", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(fileSignatureMatchesMime(png, "image/png"), true);
  });

  it("accepts an OOXML DOCX signature", () => {
    const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    assert.equal(
      fileSignatureMatchesMime(
        docx,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
      true,
    );
  });

  it("rejects a text/plain header wrapped around HTML", () => {
    const html = new Uint8Array(
      [...Array.from("<html><body>").keys()].map((_, index) =>
        "<html><body>".charCodeAt(index),
      ),
    );
    assert.equal(fileSignatureMatchesMime(html, "application/pdf"), false);
  });
});

describe("checkRateLimit", () => {
  it("allows up to max, then denies with Retry-After", () => {
    clearRateLimitsForTests();
    const now = 1_000;
    for (let call = 0; call < 3; call += 1) {
      const result = checkRateLimit("test", { windowMs: 60_000, max: 3 }, now);
      assert.equal(result.allowed, true);
    }
    const denied = checkRateLimit("test", { windowMs: 60_000, max: 3 }, now);
    assert.equal(denied.allowed, false);
    assert.ok(denied.retryAfterSeconds >= 1);
  });

  it("recovers after the window expires", () => {
    clearRateLimitsForTests();
    const start = 1_000;
    checkRateLimit("recover", { windowMs: 60_000, max: 1 }, start);
    const denied = checkRateLimit("recover", { windowMs: 60_000, max: 1 }, start);
    assert.equal(denied.allowed, false);
    const later = checkRateLimit(
      "recover",
      { windowMs: 60_000, max: 1 },
      start + 61_000,
    );
    assert.equal(later.allowed, true);
  });
});

describe("requestClientAddress", () => {
  it("prefers the first forwarded address", () => {
    const request = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });
    assert.equal(requestClientAddress(request), "203.0.113.9");
  });

  it("falls back when no header is set", () => {
    const request = new Request("http://localhost/x");
    assert.equal(requestClientAddress(request), "anonymous");
  });
});

describe("safeRelativeCallbackUrl", () => {
  it("passes safe relative paths through untouched", () => {
    assert.equal(
      safeRelativeCallbackUrl("/dashboard", "/"),
      "/dashboard",
    );
  });

  it("falls back for absolute URLs and protocol-relative paths", () => {
    assert.equal(safeRelativeCallbackUrl("https://evil.example/", "/"), "/");
    assert.equal(safeRelativeCallbackUrl("//evil.example/", "/"), "/");
  });

  it("falls back for encoded and double-encoded traversal", () => {
    for (const value of [
      "/..%2fadmin",
      "/%2e%2e/admin",
      "/%252e%252e/admin",
      "/foo/../..",
      "/valid%00.pdf",
    ]) {
      assert.equal(safeRelativeCallbackUrl(value, "/"), "/");
    }
  });
});

describe("contentDispositionHeader", () => {
  it("emits both filename and filename* variants", () => {
    const header = contentDispositionHeader("attachment", "receipt.pdf");
    assert.match(header, /^attachment; filename="receipt.pdf"; filename\*=UTF-8''receipt.pdf$/);
  });

  it("strips CR/LF from user-supplied filenames to prevent header injection", () => {
    const header = contentDispositionHeader(
      "inline",
      'foo.pdf"; other-header=abc\r\nX-Injected: 1',
    );
    // Header injection needs an actual CR or LF to split; the sanitiser must
    // remove both from the quoted-string form, and RFC 5987 percent-encodes
    // them in the filename* form.
    assert.doesNotMatch(header, /[\r\n]/);
    assert.match(header, /^inline; filename="[^"\r\n]+"; filename\*=UTF-8''/);
  });
});
