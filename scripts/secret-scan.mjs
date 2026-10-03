import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const ignoredDirs = new Set([".git", "node_modules", "dist", "build", "coverage"]);
const ignoredFiles = new Set(["scripts/secret-scan.mjs"]);
const maxBytes = 1024 * 1024;

const patterns = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["github-token", /gh[pousr]_[A-Za-z0-9_]{20,}/],
  ["aws-access-key", /AKIA[0-9A-Z]{16}/],
  ["stripe-live-key", /(?:sk|rk)_live_[A-Za-z0-9]{16,}/],
  ["slack-token", /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ["generic-secret-assignment", /(?:api[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token|password)\s*[:=]\s*["'][^"'\n]{16,}["']/i],
];

async function walk(relative = "") {
  const entries = await readdir(join(root, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    const child = join(relative, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) files.push(...await walk(child));
    } else if (entry.isFile()) files.push(child.replaceAll("\\", "/"));
  }
  return files;
}

const findings = [];
for (const path of await walk()) {
  if (ignoredFiles.has(path)) continue;
  let content;
  try {
    const file = await readFile(join(root, path));
    if (file.length > maxBytes || file.includes(0)) continue;
    content = file.toString("utf8");
  } catch {
    continue;
  }
  for (const [name, pattern] of patterns) {
    if (pattern.test(content)) findings.push({ path, pattern: name });
  }
}

if (findings.length) {
  console.error(JSON.stringify({ passed: false, findings }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ passed: true, filesScanned: (await walk()).length }, null, 2));
