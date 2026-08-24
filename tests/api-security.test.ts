import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generateApiKey,
  hashApiKey,
  keyPrefixFromPlaintext,
} from "../src/lib/api/keys";
import { isApiScope, normaliseScopes } from "../src/lib/api/scopes";
import { parsePagination } from "../src/lib/api/response";

test("generateApiKey produces a namespaced key with a matching hash and prefix", () => {
  const key = generateApiKey();
  assert.match(key.plaintext, /^dpp_live_[a-f0-9]{12}_[A-Za-z0-9_-]+$/);
  assert.equal(key.keyHash, hashApiKey(key.plaintext));
  assert.equal(keyPrefixFromPlaintext(key.plaintext), key.keyPrefix);
  assert.equal(key.keyHash.length, 64);
});

test("each generated key is unique", () => {
  const first = generateApiKey();
  const second = generateApiKey();
  assert.notEqual(first.plaintext, second.plaintext);
  assert.notEqual(first.keyHash, second.keyHash);
});

test("hashApiKey is deterministic and never returns the plaintext", () => {
  const hashed = hashApiKey("dpp_live_abcdef012345_secret");
  assert.equal(hashed, hashApiKey("dpp_live_abcdef012345_secret"));
  assert.doesNotMatch(hashed, /secret/);
});

test("keyPrefixFromPlaintext rejects malformed keys", () => {
  assert.equal(keyPrefixFromPlaintext("not-a-key"), null);
  assert.equal(keyPrefixFromPlaintext("dpp_live_short_secret"), null);
});

test("normaliseScopes keeps only known scopes and de-duplicates", () => {
  assert.deepEqual(
    normaliseScopes(["applications:read", "applications:read", "nope", 42]),
    ["applications:read"],
  );
  assert.deepEqual(normaliseScopes("applications:read"), []);
  assert.equal(isApiScope("statistics:read"), true);
  assert.equal(isApiScope("write:everything"), false);
});

test("parsePagination clamps limit and offset to safe bounds", () => {
  const base = "https://example.gov.uk/api/v1/applications";
  assert.deepEqual(parsePagination(new URL(base)), { limit: 25, offset: 0 });
  assert.deepEqual(parsePagination(new URL(`${base}?limit=1000`)), {
    limit: 100,
    offset: 0,
  });
  assert.deepEqual(parsePagination(new URL(`${base}?limit=-5&offset=-9`)), {
    limit: 1,
    offset: 0,
  });
  assert.deepEqual(parsePagination(new URL(`${base}?limit=10&offset=40`)), {
    limit: 10,
    offset: 40,
  });
});
