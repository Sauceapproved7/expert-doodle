import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = ".github/workflows";
const files = (await readdir(ROOT))
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .sort();

const failures = [];

for (const name of files) {
  const path = join(ROOT, name);
  const text = await readFile(path, "utf8");

  if (text.includes("\\n")) {
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      if (line.includes("\\n")) {
        failures.push(`${path}:${index + 1}: literal \\n escape found in workflow YAML`);
      }
    });
  }

  const lines = text.split("\n");
  lines.forEach((line, index) => {
    if (/\t/.test(line)) {
      failures.push(`${path}:${index + 1}: tab indentation is not allowed`);
    }
    if (/^\s*run:\s*\|\\n/.test(line)) {
      failures.push(`${path}:${index + 1}: malformed run block scalar`);
    }
  });

  if (!/^name:\s*\S+/m.test(text)) {
    failures.push(`${path}: missing workflow name`);
  }
  if (!/^on:\s*(?:$|\{)/m.test(text)) {
    failures.push(`${path}: missing top-level on trigger`);
  }
  if (!/^jobs:\s*$/m.test(text)) {
    failures.push(`${path}: missing top-level jobs block`);
  }
}

if (failures.length) {
  console.error("Workflow integrity gate failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Workflow integrity gate passed for ${files.length} workflow files.`);
