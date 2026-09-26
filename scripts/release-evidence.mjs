import {createHash} from "node:crypto";
import {mkdir, readFile, readdir, stat, writeFile} from "node:fs/promises";
import {join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

function parseArgs(argv) {
  const out = {outputDir: "benchmarks/release-evidence"};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--output-dir") out.outputDir = argv[++i];
    else throw new Error("unknown_argument:" + argv[i]);
  }
  return out;
}

async function walk(relative) {
  const absolute = join(root, relative);
  const info = await stat(absolute);
  if (info.isFile()) return [relative.replaceAll("\\", "/")];
  const entries = await readdir(absolute, {withFileTypes: true});
  const nested = [];
  for (const entry of entries) {
    const child = join(relative, entry.name);
    if (entry.isDirectory()) nested.push(...await walk(child));
    else if (entry.isFile()) nested.push(child.replaceAll("\\", "/"));
  }
  return nested;
}

async function sha256(path) {
  const bytes = await readFile(join(root, path));
  return {
    path,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function spdxId(value) {
  return "SPDXRef-" + String(value).replace(/[^A-Za-z0-9.-]+/g, "-");
}

const {outputDir} = parseArgs(process.argv.slice(2));
const destination = resolve(root, outputDir);
await mkdir(destination, {recursive: true});

const policy = JSON.parse(
  await readFile(join(root, "governance/owner-code-policy.json"), "utf8"),
);
const roots = policy.runtimeRoots.map((item) => item.path);
const paths = (await Promise.all(roots.map(walk))).flat().sort();
const files = await Promise.all(paths.map(sha256));
const commitSha = String(process.env.GITHUB_SHA || "unresolved");

const manifest = {
  schema: "sauceapproved.hercules.release-evidence",
  version: 1,
  generatedAt: new Date().toISOString(),
  canonicalRepository: policy.canonicalRepository,
  commitSha,
  runtimeRoots: policy.runtimeRoots,
  files,
  aggregateSha256: createHash("sha256")
    .update(files.map((file) => file.path + ":" + file.sha256).join("\n"))
    .digest("hex"),
};

const herculesSpdx = "SPDXRef-Package-Hercules";
const externalPackages = policy.externalInfrastructure.map((item) => ({
  SPDXID: spdxId("External-" + item.id),
  name: item.name,
  versionInfo: "NOASSERTION",
  downloadLocation: "NOASSERTION",
  filesAnalyzed: false,
  licenseConcluded: "NOASSERTION",
  licenseDeclared: "NOASSERTION",
  copyrightText: "NOASSERTION",
  comment: "External infrastructure boundary; not packaged as Hercules-owned source.",
}));

const sbom = {
  spdxVersion: "SPDX-2.3",
  dataLicense: "CC0-1.0",
  SPDXID: "SPDXRef-DOCUMENT",
  name: "Hercules runtime source SBOM",
  documentNamespace:
    "https://github.com/" + policy.canonicalRepository + "/tree/" + commitSha + "/spdx/runtime",
  creationInfo: {
    created: new Date().toISOString(),
    creators: ["Tool: Hercules release-evidence v1"],
  },
  packages: [
    {
      SPDXID: herculesSpdx,
      name: "Hercules runtime source",
      versionInfo: commitSha,
      downloadLocation:
        commitSha === "unresolved"
          ? "NOASSERTION"
          : "https://github.com/" + policy.canonicalRepository + "/tree/" + commitSha,
      filesAnalyzed: false,
      licenseConcluded: "Apache-2.0",
      licenseDeclared: "Apache-2.0",
      copyrightText: "NOASSERTION",
    },
    ...externalPackages,
  ],
  relationships: externalPackages.map((pkg) => ({
    spdxElementId: herculesSpdx,
    relationshipType: "DEPENDS_ON",
    relatedSpdxElement: pkg.SPDXID,
  })),
};

await writeFile(
  join(destination, "hercules-runtime-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(
  join(destination, "hercules-runtime.spdx.json"),
  JSON.stringify(sbom, null, 2) + "\n",
);

console.log(JSON.stringify({
  ok: true,
  commitSha,
  files: files.length,
  aggregateSha256: manifest.aggregateSha256,
  outputDir: destination,
}, null, 2));
