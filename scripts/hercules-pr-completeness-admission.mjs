import { readFile, realpath, lstat } from "node:fs/promises";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { evaluateCompletion } from "./hercules-completeness-gate.mjs";

export const ADMISSION_POLICY_START = "2026-10-15T00:00:00Z";
export const EVIDENCE_DIR = ".hercules/completion-evidence/";
const REPO = "Sauceapproved7/expert-doodle";
const DOC_ONLY = /^(?:docs\/[^/]+(?:\/[^/]+)*\.md|README\.md|CHANGELOG\.md)$/i;

function safeRepoPath(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 512 &&
    !isAbsolute(value) && !value.includes("\\") && !value.includes("\0") &&
    !value.split("/").some((part) => !part || part === "." || part === "..");
}
function readDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value)) return null;
  const valueMs = Date.parse(value);
  return Number.isFinite(valueMs) ? valueMs : null;
}
function sameInventory(expected, received) {
  return expected.length === received.length &&
    expected.every((file, i) => file === received[i]);
}
function normalizedFiles(changedFiles, errors) {
  if (!Array.isArray(changedFiles) || !changedFiles.length) {
    errors.push("PR changed-file list must be nonempty");
    return [];
  }
  const files = [];
  const seen = new Set();
  for (const path of changedFiles) {
    if (!safeRepoPath(path)) errors.push(`unsafe changed-file path ${JSON.stringify(path)}`);
    else if (seen.has(path)) errors.push(`duplicate changed-file path: ${path}`);
    else {
      files.push(path);
      seen.add(path);
    }
  }
  return files.sort();
}

export async function assessPullRequest({
  createdAt,
  cutoff = ADMISSION_POLICY_START,
  repo = REPO,
  changedFiles,
  root = process.cwd()
}) {
  const errors = [];
  if (repo !== REPO) errors.push(`unexpected canonical repository: ${repo}`);
  const started = readDate(cutoff);
  const created = readDate(createdAt);
  if (created === null || started === null) errors.push("invalid PR createdAt or policy cutoff timestamp");
  const files = normalizedFiles(changedFiles, errors);
  const required = files.some((path) => !DOC_ONLY.test(path));
  const result = {
    schema: "sauceapproved.hercules.pr-completion-admission",
    version: 1,
    ok: false,
    required,
    reason: "invalid",
    errors
  };
  if (errors.length) return result;
  if (created < started) return { ...result, ok: true, reason: "predates_policy", grandfathered: true };
  if (!required) return { ...result, ok: true, reason: "documentation_only" };
  const manifests = files.filter((path) =>
    path.startsWith(EVIDENCE_DIR) &&
    /^\.hercules\/completion-evidence\/[A-Za-z0-9][A-Za-z0-9_-]*\.json$/.test(path)
  );
  if (manifests.length !== 1) {
    errors.push("new material PR requires exactly one changed completion manifest in .hercules/completion-evidence/");
    return { ...result, reason: "missing_completion_manifest" };
  }
  const manifestPath = manifests[0];
  let manifest;
  try {
    const repoReal = await realpath(root);
    const absolute = resolve(repoReal, manifestPath);
    const pathRel = relative(repoReal, absolute);
    if (pathRel.startsWith(".." + sep) || pathRel === ".." || isAbsolute(pathRel)) {
      throw new Error("manifest escapes repository root");
    }
    if ((await lstat(absolute)).isSymbolicLink()) throw new Error("manifest symlink is forbidden");
    const actual = await realpath(absolute);
    const actualRel = relative(repoReal, actual);
    if (actualRel.startsWith(".." + sep) || actualRel === ".." || isAbsolute(actualRel)) {
      throw new Error("manifest resolves outside repository root");
    }
    manifest = JSON.parse(await readFile(actual, "utf8"));
  } catch (error) {
    errors.push(`cannot read changed completion manifest ${manifestPath}: ${error.message}`);
    return { ...result, reason: "invalid_completion_manifest" };
  }
  if (manifest.scope === "documentation-only") errors.push("material PR cannot declare documentation-only completion scope");
  const inventory = Array.isArray(manifest.changedFiles) ? [...manifest.changedFiles].sort() : [];
  if (!sameInventory(files, inventory) || new Set(inventory).size !== inventory.length) {
    errors.push("completion manifest changedFiles inventory must exactly match every changed PR file");
  }
  const closure = await evaluateCompletion(manifest, root);
  if (!closure.ready) errors.push(...closure.errors.map((error) => `completion: ${error}`));
  return {
    ...result,
    ok: errors.length === 0,
    reason: errors.length ? "closure_not_verified" : "admitted",
    manifestPath,
    phasesChecked: closure.phasesChecked,
    acceptanceChecked: closure.acceptanceChecked
  };
}

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH is required for PR admission");
  const event = JSON.parse(await readFile(eventPath, "utf8"));
  const pr = event.pull_request;
  if (!pr) throw new Error("GitHub event does not contain pull_request");
  const baseSHA = pr.base?.sha;
  if (!/^[a-f0-9]{40}$/i.test(baseSHA ?? "")) throw new Error("invalid GitHub base commit SHA");
  const command = spawnSync("git", ["diff", "--name-only", "-z", "--diff-filter=ACDMRT", baseSHA, "HEAD"], {
    encoding: "utf8", maxBuffer: 8 * 1024 * 1024, shell: false
  });
  if (command.error || command.status !== 0) {
    throw new Error(`cannot enumerate changed PR files: ${command.error?.message ?? command.stderr}`);
  }
  const changedFiles = command.stdout.split("\0").filter(Boolean);
  const result = await assessPullRequest({
    createdAt: pr.created_at,
    repo: event.repository?.full_name,
    changedFiles
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  main().catch((error) => {
    console.error(`Hercules PR admission failed closed: ${error.message}`);
    process.exitCode = 2;
  });
}
