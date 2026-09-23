import {mkdir, readFile, writeFile} from "node:fs/promises";
import {dirname, join} from "node:path";
import {compileForgeProject} from "./compiler.mjs";

const [specPath, outputPath = "forge-output"] = process.argv.slice(2);

if (!specPath) {
  console.error("usage: node hercules-forge/cli.mjs <spec.json> [output-directory]");
  process.exit(2);
}

const spec = JSON.parse(await readFile(specPath, "utf8"));
const result = compileForgeProject(spec);

for (const [relative, content] of Object.entries(result.files)) {
  const destination = join(outputPath, relative);
  await mkdir(dirname(destination), {recursive: true});
  await writeFile(destination, content, "utf8");
}

await writeFile(
  join(outputPath, "forge.build.json"),
  JSON.stringify({
    engine: result.engine,
    engineVersion: result.engineVersion,
    fingerprint: result.fingerprint,
  }, null, 2) + "\n",
  "utf8",
);

console.log(JSON.stringify({
  ok: true,
  outputPath,
  fingerprint: result.fingerprint,
  files: Object.keys(result.files),
}, null, 2));
