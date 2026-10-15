import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, relative, isAbsolute, sep } from "node:path";

export const REQUIRED_PHASES = Object.freeze([
  "research", "design", "implementation", "tests",
  "security", "documentation", "release", "verification"
]);

const SCOPES = new Set(["source-only", "documentation-only", "staging", "production"]);
const STATES = new Set(["verified", "not_applicable", "blocked", "failed", "unverified"]);

function stringPresent(value) {
  return typeof value === "string" && value.trim().length >= 4;
}

async function validateEvidence(paths, root, label, errors) {
  if (!Array.isArray(paths) || paths.length === 0) {
    errors.push(`${label}: evidencePaths must contain at least one file`);
    return;
  }
  const rootReal = await realpath(root).catch(() => null);
  if (!rootReal) {
    errors.push(`${label}: evidence root does not exist`);
    return;
  }
  for (const path of paths) {
    if (typeof path !== "string" || !path.trim() || isAbsolute(path) ||
      path.includes("\\") || path.split("/").some((part) => part === ".." || part === "." || !part)) {
      errors.push(`${label}: unsafe evidence path ${JSON.stringify(path)}`);
      continue;
    }
    const candidate = resolve(rootReal, path);
    const rel = relative(rootReal, candidate);
    if (rel.startsWith(".." + sep) || rel === ".." || isAbsolute(rel)) {
      errors.push(`${label}: unsafe evidence path ${JSON.stringify(path)}`);
      continue;
    }
    try {
      const target = await realpath(candidate);
      const targetRel = relative(rootReal, target);
      if (targetRel.startsWith(".." + sep) || targetRel === ".." || isAbsolute(targetRel)) {
        errors.push(`${label}: unsafe symlink target for ${path}`);
      } else if (!(await stat(target)).isFile()) {
        errors.push(`${label}: evidence is not a file: ${path}`);
      }
    } catch {
      errors.push(`${label}: evidence file missing: ${path}`);
    }
  }
}

export async function evaluateCompletion(manifest, root = process.cwd()) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { schema: "sauceapproved.hercules.completion-gate-result", ready: false, errors: ["manifest must be an object"] };
  }
  if (manifest.schema !== "sauceapproved.hercules.completion-evidence") errors.push("schema mismatch");
  if (manifest.version !== 1) errors.push("version must be 1");
  if (!stringPresent(manifest.title)) errors.push("title is required");
  if (!stringPresent(manifest.intendedOutcome)) errors.push("intendedOutcome is required");
  if (!SCOPES.has(manifest.scope)) errors.push("scope must be source-only, documentation-only, staging or production");

  if (!Array.isArray(manifest.research) || manifest.research.length === 0) {
    errors.push("research must include prior-art or existing-state investigation");
  } else {
    for (const [i, row] of manifest.research.entries()) {
      if (!stringPresent(row?.question) || !stringPresent(row?.finding)) errors.push(`research[${i}]: question and finding required`);
      await validateEvidence(row?.evidencePaths, root, `research[${i}]`, errors);
    }
  }

  if (!Array.isArray(manifest.acceptance) || manifest.acceptance.length === 0) {
    errors.push("acceptance must contain at least one evidenced criterion");
  } else {
    const seen = new Set();
    for (const [i, row] of manifest.acceptance.entries()) {
      if (!stringPresent(row?.id) || !stringPresent(row?.requirement)) errors.push(`acceptance[${i}]: id and requirement required`);
      if (seen.has(row?.id)) errors.push(`acceptance[${i}]: duplicate id ${row?.id}`);
      seen.add(row?.id);
      if (row?.status !== "verified") errors.push(`acceptance[${i}]: requirement not verified`);
      await validateEvidence(row?.evidencePaths, root, `acceptance[${i}]`, errors);
    }
  }

  const found = new Set();
  if (!Array.isArray(manifest.phases)) {
    errors.push("phases must be an array");
  } else {
    for (const [i, phase] of manifest.phases.entries()) {
      const id = phase?.id;
      if (!REQUIRED_PHASES.includes(id)) errors.push(`phases[${i}]: unknown phase ${id}`);
      if (found.has(id)) errors.push(`phases[${i}]: duplicate phase ${id}`);
      found.add(id);
      if (!STATES.has(phase?.status)) {
        errors.push(`phases[${i}]: invalid status`);
      } else if (phase.status === "verified") {
        await validateEvidence(phase.evidencePaths, root, `phase ${id}`, errors);
      } else if (phase.status === "not_applicable") {
        if (!stringPresent(phase.reason) || phase.reason.trim().length < 20) {
          errors.push(`phase ${id}: not_applicable requires substantive reason`);
        }
        if (id === "tests" && manifest.scope !== "documentation-only") {
          errors.push("phase tests: tests cannot be waived for a behavioral or code change");
        }
        if (id === "release" && (manifest.scope === "staging" || manifest.scope === "production")) {
          errors.push("phase release: deployment evidence is required for staging or production scope");
        }
      } else {
        errors.push(`phase ${id}: ${phase.status} cannot establish completion`);
      }
    }
  }
  for (const id of REQUIRED_PHASES) {
    if (!found.has(id)) errors.push(`missing required phase: ${id}`);
  }
  if (!Array.isArray(manifest.openThreads)) {
    errors.push("openThreads must be an array");
  } else if (manifest.openThreads.length) {
    errors.push(`openThreads contains ${manifest.openThreads.length} unresolved item(s)`);
  }
  return {
    schema: "sauceapproved.hercules.completion-gate-result",
    version: 1,
    ready: errors.length === 0,
    errors,
    phasesChecked: found.size,
    acceptanceChecked: Array.isArray(manifest.acceptance) ? manifest.acceptance.length : 0,
    limitation: "File-existence and manifest-structure checks are not proof that tests, deployment or remote services actually succeeded; independently verify with exact-head CI and provider evidence."
  };
}

async function main(argv) {
  const manifestIndex = argv.indexOf("--manifest");
  const rootIndex = argv.indexOf("--root");
  if (manifestIndex < 0 || !argv[manifestIndex + 1]) {
    console.error("Usage: node scripts/hercules-completeness-gate.mjs --manifest path [--root directory] --require-complete");
    process.exitCode = 2;
    return;
  }
  const manifestPath = resolve(argv[manifestIndex + 1]);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    console.error(`Unable to read completion manifest: ${error.message}`);
    process.exitCode = 2;
    return;
  }
  const root = rootIndex >= 0 && argv[rootIndex + 1] ? argv[rootIndex + 1] : process.cwd();
  const report = await evaluateCompletion(manifest, root);
  console.log(JSON.stringify(report, null, 2));
  if (argv.includes("--require-complete") && !report.ready) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 2;
  });
}
