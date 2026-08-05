import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([".azure", ".git", ".next", "node_modules"]);

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(fullPath)));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(fullPath);
  }
  return files;
}

function slugify(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function anchors(markdown) {
  const seen = new Map();
  const values = new Set();
  for (const line of markdown.split("\n")) {
    const match = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (!match) continue;
    const base = slugify(match[1]);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    values.add(count === 0 ? base : `${base}-${count}`);
  }
  return values;
}

const files = await markdownFiles(root);
const contentByPath = new Map();
for (const file of files) contentByPath.set(file, await readFile(file, "utf8"));

const failures = [];
const linkPattern = /(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;

for (const [file, markdown] of contentByPath) {
  for (const match of markdown.matchAll(linkPattern)) {
    const rawTarget = match[1].replace(/^<|>$/g, "");
    if (/^(https?:|mailto:)/i.test(rawTarget)) continue;

    const [rawPath, fragment] = rawTarget.split("#", 2);
    const decodedPath = decodeURIComponent(rawPath);
    const targetPath = decodedPath
      ? path.resolve(path.dirname(file), decodedPath)
      : file;

    let targetStat;
    try {
      targetStat = await stat(targetPath);
    } catch {
      failures.push(`${path.relative(root, file)} -> missing ${rawTarget}`);
      continue;
    }

    if (!fragment || targetStat.isDirectory()) continue;
    if (!targetPath.endsWith(".md")) continue;

    const targetContent =
      contentByPath.get(targetPath) ?? (await readFile(targetPath, "utf8"));
    if (!anchors(targetContent).has(decodeURIComponent(fragment).toLowerCase())) {
      failures.push(`${path.relative(root, file)} -> missing anchor ${rawTarget}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Markdown link validation failed:\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(`Validated local links in ${files.length} Markdown files.`);