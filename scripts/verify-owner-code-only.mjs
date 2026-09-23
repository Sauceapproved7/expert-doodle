import {readFile, readdir, stat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const policyPath = path.join(repoRoot, "governance", "owner-code-policy.json");

function posix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function relativeToRepo(absolutePath) {
  return posix(path.relative(repoRoot, absolutePath));
}

async function exists(absolutePath) {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(absolutePath, {
  skipNames = new Set([".git", ".hercules-forge", ".hercules-training", ".hercules-video"]),
} = {}) {
  const output = [];
  for (const entry of await readdir(absolutePath, {withFileTypes:true})) {
    if (skipNames.has(entry.name)) continue;
    const child = path.join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      output.push(...await walk(child, {skipNames}));
    } else if (entry.isFile()) {
      output.push(child);
    }
  }
  return output;
}

function sourceModuleSpecifiers(content) {
  const values = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) values.push(match[1]);
  }
  return values;
}

function isModuleSource(filePath) {
  return /\.(?:mjs|cjs|js|mts|cts|ts)$/.test(filePath);
}

function isInsideRoot(relativePath, roots) {
  return roots.some((root) => relativePath === root || relativePath.startsWith(root + "/"));
}

function resolveRelativeImport(fromRelativePath, specifier) {
  const base = path.posix.dirname(posix(fromRelativePath));
  return path.posix.normalize(path.posix.join(base, specifier));
}

function unique(values) {
  return [...new Set(values)];
}

export async function verifyOwnerCodePolicy() {
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  const errors = [];
  const evidence = {
    schema: "sauceapproved.hercules.owner-code-verification",
    version: 1,
    policyVersion: policy.version,
    declaredRightsHolder: policy.declaredRightsHolder,
    runtimeRoots: [],
    moduleFilesScanned: 0,
    relativeImportsVerified: 0,
    nodeBuiltinImportsVerified: 0,
    childProcessBoundariesVerified: 0,
    shellBoundariesVerified: 0,
    containerImagesVerified: [],
    workflowActionsVerified: [],
    forbiddenArtifactsFound: 0,
  };

  if (policy.schema !== "sauceapproved.hercules.owner-code-policy") {
    errors.push("owner-code policy schema is invalid");
  }
  if (policy.declaredRightsHolder !== "Sauceapproved7") {
    errors.push("owner-code policy rights holder is not Sauceapproved7");
  }
  if (policy.canonicalRepository !== "Sauceapproved7/expert-doodle") {
    errors.push("owner-code policy canonical repository mismatch");
  }

  const runtimeRoots = (policy.runtimeRoots ?? []).map((entry) => String(entry.path));
  if (runtimeRoots.length === 0) errors.push("owner-code policy has no runtime roots");

  for (const root of runtimeRoots) {
    const absolute = path.join(repoRoot, root);
    if (!await exists(absolute)) {
      errors.push("declared runtime root is missing: " + root);
    } else {
      evidence.runtimeRoots.push(root);
    }
  }

  const allFiles = await walk(repoRoot);
  const allRelative = allFiles.map(relativeToRepo);

  const forbiddenDirs = new Set(policy.forbiddenDirectoryNames ?? []);
  for (const relativePath of allRelative) {
    const segments = relativePath.split("/");
    for (const segment of segments.slice(0, -1)) {
      if (forbiddenDirs.has(segment)) {
        errors.push("forbidden vendored/dependency directory in repository: " + relativePath);
        evidence.forbiddenArtifactsFound += 1;
        break;
      }
    }
  }

  const forbiddenExtensions = new Set(policy.forbiddenCommittedExtensions ?? []);
  for (const relativePath of allRelative) {
    const extension = path.posix.extname(relativePath).toLowerCase();
    if (forbiddenExtensions.has(extension)) {
      errors.push("forbidden committed binary/archive/model artifact: " + relativePath);
      evidence.forbiddenArtifactsFound += 1;
    }
  }

  if (allRelative.includes(".gitmodules")) {
    errors.push("git submodules are not allowed under owner-code-only policy");
    evidence.forbiddenArtifactsFound += 1;
  }

  const runtimeFiles = allRelative.filter((relativePath) => isInsideRoot(relativePath, runtimeRoots));
  const forbiddenDependencyFiles = new Set(policy.forbiddenDependencyFiles ?? []);
  for (const relativePath of runtimeFiles) {
    const basename = path.posix.basename(relativePath);
    if (forbiddenDependencyFiles.has(basename)) {
      errors.push("runtime dependency manifest/vendor build file is forbidden: " + relativePath);
    }
  }

  const allowedPrefixes = policy.allowedModuleSpecifierPrefixes ?? ["./", "../", "node:"];
  for (const relativePath of runtimeFiles.filter(isModuleSource)) {
    evidence.moduleFilesScanned += 1;
    const content = await readFile(path.join(repoRoot, relativePath), "utf8");
    for (const specifier of sourceModuleSpecifiers(content)) {
      if (specifier.startsWith("node:")) {
        evidence.nodeBuiltinImportsVerified += 1;
        continue;
      }
      if (specifier.startsWith("./") || specifier.startsWith("../")) {
        evidence.relativeImportsVerified += 1;
        const resolved = resolveRelativeImport(relativePath, specifier);
        if (resolved.startsWith("../") || !isInsideRoot(resolved, runtimeRoots)) {
          errors.push(
            "runtime source imports code outside owner-code roots: "
            + relativePath + " -> " + specifier
          );
        }
        continue;
      }
      if (!allowedPrefixes.some((prefix) => specifier.startsWith(prefix))) {
        errors.push("third-party/bare runtime module import is forbidden: " + relativePath + " -> " + specifier);
      }
    }
  }

  const declaredProcesses = new Map(
    (policy.childProcessBoundaries ?? []).map((entry) => [String(entry.path), entry]),
  );
  const childProcessUsers = [];
  for (const relativePath of runtimeFiles.filter(isModuleSource)) {
    const content = await readFile(path.join(repoRoot, relativePath), "utf8");
    if (content.includes("node:child_process")) childProcessUsers.push(relativePath);
  }
  for (const relativePath of childProcessUsers) {
    if (!declaredProcesses.has(relativePath)) {
      errors.push("undeclared child-process boundary: " + relativePath);
    } else {
      evidence.childProcessBoundariesVerified += 1;
    }
  }
  for (const relativePath of declaredProcesses.keys()) {
    if (!childProcessUsers.includes(relativePath)) {
      errors.push("declared child-process boundary is stale or missing: " + relativePath);
    }
  }

  const infrastructureIds = new Set((policy.externalInfrastructure ?? []).map((entry) => String(entry.id)));
  for (const entry of policy.externalInfrastructure ?? []) {
    if (entry.packagedAsHerculesCode !== false) {
      errors.push("external infrastructure must be marked not packaged as Hercules code: " + entry.id);
    }
  }
  for (const entry of [
    ...(policy.childProcessBoundaries ?? []),
    ...(policy.shellCommandBoundaries ?? []),
  ]) {
    for (const dependency of entry.dependencies ?? []) {
      if (!infrastructureIds.has(String(dependency))) {
        errors.push("boundary references undeclared external infrastructure: " + entry.path + " -> " + dependency);
      }
    }
  }

  const declaredShell = new Set((policy.shellCommandBoundaries ?? []).map((entry) => String(entry.path)));
  const shellFiles = runtimeFiles.filter((relativePath) => relativePath.endsWith(".sh"));
  for (const relativePath of shellFiles) {
    if (!declaredShell.has(relativePath)) {
      errors.push("undeclared shell/external-command boundary: " + relativePath);
    } else {
      evidence.shellBoundariesVerified += 1;
    }
  }
  for (const relativePath of declaredShell) {
    if (!shellFiles.includes(relativePath)) {
      errors.push("declared shell boundary is stale or missing: " + relativePath);
    }
  }

  const allowedImages = new Set(policy.allowedContainerImages ?? []);
  for (const relativePath of runtimeFiles.filter((item) => /\.ya?ml$/.test(item))) {
    const content = await readFile(path.join(repoRoot, relativePath), "utf8");
    for (const match of content.matchAll(/^\s*image:\s*["']?([^"'#\s]+)["']?/gm)) {
      const image = match[1];
      evidence.containerImagesVerified.push(image);
      if (!allowedImages.has(image)) {
        errors.push("undeclared external container image: " + relativePath + " -> " + image);
      }
    }
  }
  evidence.containerImagesVerified = unique(evidence.containerImagesVerified).sort();

  const workflowsDir = path.join(repoRoot, ".github", "workflows");
  const workflowFiles = await walk(workflowsDir);
  const allowedActions = new Set(policy.allowedWorkflowActions ?? []);
  for (const absolutePath of workflowFiles.filter((item) => /\.ya?ml$/.test(item))) {
    const relativePath = relativeToRepo(absolutePath);
    const content = await readFile(absolutePath, "utf8");
    for (const match of content.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)\s*$/gm)) {
      const action = match[1].replace(/^["']|["']$/g, "");
      if (action.startsWith("./")) continue;
      evidence.workflowActionsVerified.push(action);
      if (!allowedActions.has(action)) {
        errors.push("undeclared external GitHub Action: " + relativePath + " -> " + action);
      }
    }
  }
  evidence.workflowActionsVerified = unique(evidence.workflowActionsVerified).sort();

  evidence.ok = errors.length === 0;
  evidence.errors = errors;
  return evidence;
}

async function main() {
  const evidence = await verifyOwnerCodePolicy();
  console.log(JSON.stringify(evidence, null, 2));
  if (!evidence.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
