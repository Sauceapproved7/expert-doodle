import {readFile, readdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {join} from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));

async function read(path) {
  return readFile(join(root, path), "utf8");
}

async function filesUnder(path) {
  const out = [];
  async function walk(relative) {
    const entries = await readdir(join(root, relative), {withFileTypes: true});
    for (const entry of entries) {
      const child = join(relative, entry.name);
      if (entry.isDirectory()) await walk(child);
      else if (entry.isFile()) out.push(child.replaceAll("\\", "/"));
    }
  }
  await walk(path);
  return out;
}

const identity = await read("hercules-forge/identity.mjs");
const control = await read("hercules-forge/control-api.mjs");
const notifications = await read("hercules-forge/notifications.mjs");
const production = await read("hercules-forge/production.mjs");
const signer = await read("hercules-hurc/testnet-signer-edge.ts");
const signerSql = await read("hercules-hurc/sql/hurc-test-signer.sql");
const threat = await read("docs/HERCULES-THREAT-MODEL.md");
const securityPolicy = await read("SECURITY.md");
const releaseEvidence = await read("scripts/release-evidence.mjs");
const codeowners = await read(".github/CODEOWNERS");
const contributing = await read("CONTRIBUTING.md");
const openapi = await read("docs/openapi/hercules-forge-v1.yaml");
const cryptoTests = await read("tests/hercules-hurc-testnet-crypto.test.mjs");

const workflowFiles = await filesUnder(".github/workflows");
const workflowText = Object.fromEntries(
  await Promise.all(workflowFiles.map(async (path) => [path, await read(path)])),
);

const checks = {
  hardenedScrypt:
    /version:\s*"scrypt-v2"/.test(identity) &&
    /N:\s*2 \*\* 15/.test(identity) &&
    /r:\s*8/.test(identity) &&
    /p:\s*3/.test(identity),
  legacyPasswordCompatibility:
    /scheme === "scrypt-v1"/.test(identity) &&
    /New identities never use v1/.test(identity),
  legacyPasswordAutoUpgrade:
    /startsWith\("scrypt-v1\$"\)/.test(identity) &&
    /Upgrade legacy hashes only after a successful password verification/.test(identity),
  forgeSecurityHeaders:
    /strict-transport-security/.test(control) &&
    /x-frame-options/.test(control) &&
    /permissions-policy/.test(control) &&
    /x-content-type-options/.test(control),
  forgeLifecycleTokenSecurity:
    /lifecyclePath\(kind, token\)/.test(identity) &&
    /hashToken\(token\)/.test(identity) &&
    /revokeUserSessions/.test(identity) &&
    /identity\.recovery\.complete/.test(control),
  forgeRecoveryEnumerationResistance:
    /identity\.recovery\.request/.test(control) &&
    /return send\(res, 202, \{accepted: true\}\)/.test(control) &&
    /FORGE_RECOVERY_MAX_REQUESTS/.test(production),
  forgeNotificationBoundary:
    /redirect: "error"/.test(notifications) &&
    /notification endpoint must not embed credentials/.test(notifications) &&
    /FORGE_NOTIFICATION_URL must use https unless it is loopback/.test(production),
  signerAuthenticated:
    /HURC_SIGNER_CONTROL_TOKEN/.test(signer) &&
    /CONTROL\.length < 32/.test(signer) &&
    /safeEqual/.test(signer) &&
    /unauthorized/.test(signer),
  signerRequestBounded:
    /MAX_REQUEST_BYTES = 4096/.test(signer) &&
    /request_too_large/.test(signer),
  signerTestnetOnly:
    /network:\s*"base-sepolia"/.test(signer) &&
    /chainId:\s*84532/.test(signer) &&
    !/mainnetEnabled:\s*true/.test(signer),
  cryptoKnownAnswerAndLowS:
    /canonical empty-string vector/.test(cryptoTests) &&
    /known Ethereum address/.test(cryptoTests) &&
    /enforces low-s/.test(cryptoTests) &&
    /only supports Base Sepolia/.test(cryptoTests),
  signerRegistryLocked:
    /force row level security/i.test(signerSql) &&
    /revoke all on table public\.hercules_hurc_test_signers from anon, authenticated/i.test(signerSql) &&
    /one_active_signer_per_network/i.test(signerSql),
  documentedThreatModel:
    threat.includes("## Trust boundaries") &&
    threat.includes("## Explicit non-claims"),
  vulnerabilityPolicy:
    securityPolicy.includes("## Reporting a vulnerability") &&
    securityPolicy.includes("Do **not** publish exploitable details"),
  codeqlGate:
    /github\/codeql-action\/init@[0-9a-f]{40}/.test(workflowText[".github/workflows/hercules-codeql.yml"] ?? "") &&
    /github\/codeql-action\/analyze@[0-9a-f]{40}/.test(workflowText[".github/workflows/hercules-codeql.yml"] ?? ""),
  signedReleaseEvidenceGate:
    /actions\/attest@508db95dd578ae2727ebd6217d5ba78e4fbda05d/.test(workflowText[".github/workflows/hercules-release-evidence.yml"] ?? "") &&
    /artifact-metadata:\s*write/.test(workflowText[".github/workflows/hercules-release-evidence.yml"] ?? "") &&
    /sbom-path:/.test(workflowText[".github/workflows/hercules-release-evidence.yml"] ?? "") &&
    /SPDX-2\.3/.test(releaseEvidence),
  deterministicReleaseBundle:
    /--sort=name/.test(workflowText[".github/workflows/hercules-release-evidence.yml"] ?? "") &&
    /--mtime='UTC 1970-01-01'/.test(workflowText[".github/workflows/hercules-release-evidence.yml"] ?? "") &&
    /gzip -n/.test(workflowText[".github/workflows/hercules-release-evidence.yml"] ?? ""),
  repositoryOwnership:
    /^\*\s+@Sauceapproved7\s*$/m.test(codeowners),
  contributionSecurityContract:
    /Security-sensitive changes/.test(contributing) &&
    /CodeQL/.test(contributing) &&
    /THREAT-MODEL/.test(contributing),
  forgeOpenApiContract:
    /^openapi:\s*3\.2\.1$/m.test(openapi) &&
    /controlBearer:/.test(openapi) &&
    /x-forge-csrf/.test(openapi),
  noPullRequestTarget: Object.values(workflowText).every(
    (text) => !/^\s*pull_request_target\s*:/m.test(text),
  ),
  noWriteAllPermissions: Object.values(workflowText).every(
    (text) => !/^\s*permissions\s*:\s*write-all\s*$/m.test(text),
  ),
  actionsPinnedBySha: Object.values(workflowText).every((text) => {
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*-?\s*uses:\s*([^\s#]+)\s*$/);
      if (!match) continue;
      const spec = match[1];
      if (spec.startsWith("./")) continue;
      if (!/@[0-9a-f]{40}$/i.test(spec)) return false;
    }
    return true;
  }),
};

const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
const evidence = {
  schema: "sauceapproved.hercules.security-baseline",
  version: 1,
  generatedAt: new Date().toISOString(),
  checks,
  passed: failed.length === 0,
  failed,
};

console.log(JSON.stringify({
  schema: evidence.schema,
  version: evidence.version,
  passed: evidence.passed,
  failed: evidence.failed,
}, null, 2));
if (failed.length) process.exitCode = 1;
