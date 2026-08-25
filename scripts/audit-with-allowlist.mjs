#!/usr/bin/env node
/**
 * Wraps `npm audit --json` so we can allow specific advisories that have no
 * upstream fix while still failing the pipeline on everything else.
 *
 * ALLOWLIST must be reviewed on every dependency bump. Each entry needs a
 * clear justification of why the advisory is unfixable AND not exploitable
 * in this application.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

const ALLOWED_ADVISORIES = new Map([
  [
    "GHSA-2v37-7h3g-55p8",
    {
      package: "nanoid",
      severity: "high",
      reason:
        "postcss 8.x requires nanoid 3.x, but the advisory fix range is <3.3.18 which has not been published. postcss does not call nanoid with custom generators (size !== 0), so this app is not exploitable. Remove this allowlist entry once nanoid@3.3.18+ ships or postcss adopts nanoid@5.",
    },
  ],
  [
    "GHSA-ggr8-5vv4-36mx",
    {
      package: "deepmerge-ts",
      severity: "high",
      reason:
        "Transitive via prisma / @prisma/config, used only to merge developer-authored Prisma config at CLI/build time — not reachable with untrusted runtime input, so the prototype-pollution vector is not exploitable in this app. npm audit reports no non-breaking fix (fixAvailable is a semver-major prisma change). Remove once prisma ships a patched deepmerge-ts.",
    },
  ],
]);

const argv = process.argv.slice(2);
const auditLevel = argv.includes("--audit-level")
  ? argv[argv.indexOf("--audit-level") + 1]
  : "low";
const scope = argv.includes("--omit") ? ["--omit", argv[argv.indexOf("--omit") + 1]] : [];

const audit = spawnSync(
  "npm",
  ["audit", "--json", "--audit-level", auditLevel, ...scope],
  { encoding: "utf8" },
);
if (!audit.stdout) {
  console.error(audit.stderr || "npm audit produced no output");
  process.exit(audit.status ?? 1);
}

let report;
try {
  report = JSON.parse(audit.stdout);
} catch (error) {
  console.error("Could not parse npm audit JSON:", error);
  process.exit(1);
}

const severityRank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const threshold = severityRank[auditLevel] ?? 1;

const vulnerabilities = report.vulnerabilities ?? {};

function collectAdvisoryIds(name, seen = new Set()) {
  if (seen.has(name)) return new Set();
  seen.add(name);
  const entry = vulnerabilities[name];
  if (!entry) return new Set();
  const ids = new Set();
  for (const via of entry.via ?? []) {
    if (typeof via === "object" && via.url) {
      const match = /GHSA-[a-z0-9-]+/i.exec(via.url);
      if (match) ids.add(match[0]);
    } else if (typeof via === "string") {
      for (const id of collectAdvisoryIds(via, seen)) ids.add(id);
    }
  }
  return ids;
}

let unresolved = 0;
const allowedHits = [];

for (const [name, entry] of Object.entries(vulnerabilities)) {
  const rank = severityRank[entry.severity] ?? 0;
  if (rank < threshold) continue;
  const ids = collectAdvisoryIds(name);
  if (ids.size === 0) {
    unresolved += 1;
    console.error(
      `Unresolved advisory in ${name} (${entry.severity}): no GHSA metadata`,
    );
    continue;
  }
  const matched = [...ids].filter((id) => ALLOWED_ADVISORIES.has(id));
  if (matched.length === ids.size) {
    allowedHits.push({ name, severity: entry.severity, ids: matched });
    continue;
  }
  unresolved += 1;
  const unmatched = [...ids].filter((id) => !ALLOWED_ADVISORIES.has(id));
  console.error(
    `Unresolved advisory in ${name} (${entry.severity}): ${unmatched.join(", ")}`,
  );
}

if (allowedHits.length > 0) {
  console.log("Allowlisted advisories still present:");
  for (const hit of allowedHits) {
    for (const id of hit.ids) {
      const note = ALLOWED_ADVISORIES.get(id);
      console.log(`  - ${hit.name} ${hit.severity} ${id}: ${note?.reason}`);
    }
  }
}

if (unresolved > 0) {
  console.error(`\n${unresolved} unresolved advisor${unresolved === 1 ? "y" : "ies"}.`);
  process.exit(1);
}
console.log("\nAll advisories are either allowlisted or below the audit level.");
