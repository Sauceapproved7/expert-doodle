import {access, readFile, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {join} from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));

async function exists(relative) {
  try {
    await access(join(root, relative));
    return true;
  } catch {
    return false;
  }
}

async function text(relative) {
  try {
    return await readFile(join(root, relative), "utf8");
  } catch {
    return "";
  }
}

async function json(relative) {
  try {
    return JSON.parse(await readFile(join(root, relative), "utf8"));
  } catch {
    return null;
  }
}

function control(id, ok, evidence) {
  return {id, passed: Boolean(ok), evidence};
}

export function scoreDomain(name, weight, controls) {
  if (!Array.isArray(controls) || controls.length === 0) {
    throw new Error("benchmark domain requires controls");
  }
  const passedControls = controls.filter((item) => item.passed).length;
  const score = Math.round((passedControls / controls.length) * 10000) / 100;
  return {
    name,
    weight,
    score,
    passedControls,
    totalControls: controls.length,
    controls,
  };
}

export function calculateEvidenceScore(domains) {
  const totalWeight = domains.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight !== 100) throw new Error("benchmark weights must total 100");
  const exactScore =
    domains.reduce((sum, item) => sum + item.weight * item.score, 0) / 100;
  return {
    exactScore: Math.round(exactScore * 100) / 100,
    score: Math.round(exactScore),
  };
}

function classification(score) {
  if (score >= 85) return "strong verified engineering foundation with remaining external/production evidence gaps";
  if (score >= 70) return "verified engineering foundation with material assurance gaps";
  if (score >= 50) return "partial engineering foundation; significant evidence gaps remain";
  return "insufficient verified engineering evidence";
}

async function workflowActionsPinned() {
  const directory = join(root, ".github", "workflows");
  const {readdir} = await import("node:fs/promises");
  const files = (await readdir(directory)).filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"));
  for (const file of files) {
    const source = await readFile(join(directory, file), "utf8");
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*-?\s*uses:\s*([^\s#]+)\s*$/);
      if (!match) continue;
      const spec = match[1];
      if (spec.startsWith("./")) continue;
      if (!/@[0-9a-f]{40}$/i.test(spec)) return false;
    }
  }
  return true;
}

export async function collectBenchmark() {
  const stagingLoad = await json("benchmarks/performance/staging-load.json");
  if (
    !stagingLoad?.passed ||
    stagingLoad?.target?.origin !== "http://127.0.0.1:38080" ||
    stagingLoad?.guardrails?.fixtureOnly !== true
  ) {
    throw new Error("verified_staging_result_required");
  }

  const stagingSoak = await json("benchmarks/performance/staging-soak.json");
  const identity = await text("hercules-forge/identity.mjs");
  const controlApi = await text("hercules-forge/control-api.mjs");
  const hurcWorkflow = await text(".github/workflows/hurc-contract.yml");
  const releaseWorkflow = await text(".github/workflows/hercules-release-evidence.yml");
  const releaseEvidence = await text("scripts/release-evidence.mjs");
  const recoveryWorkflow = await text(".github/workflows/hercules-staging-recovery-drill.yml");
  const globalWorkflow = await text(".github/workflows/hercules-global-staging-benchmark.yml");
  const sloWorkflow = await text(".github/workflows/hercules-slo-evidence.yml");
  const securityWorkflow = await text(".github/workflows/hercules-security-baseline.yml");
  const codeqlWorkflow = await text(".github/workflows/hercules-codeql.yml");
  const provenanceWorkflow = await text(".github/workflows/provenance-gate.yml");
  const ownerWorkflow = await text(".github/workflows/hercules-owner-code.yml");
  const stagingScript = await text("scripts/staging-plane.mjs");
  const readme = await text("README.md");

  const pinnedActions = await workflowActionsPinned();
  const sbomImplemented =
    /SPDX-2\.3/.test(releaseEvidence) &&
    /hercules-runtime\.spdx\.json/.test(releaseEvidence) &&
    /sbom-path:/.test(releaseWorkflow);
  const signedReleaseEvidence =
    /actions\/attest@[0-9a-f]{40}/.test(releaseWorkflow) &&
    /attestations:\s*write/.test(releaseWorkflow) &&
    /id-token:\s*write/.test(releaseWorkflow);

  const domains = [
    scoreDomain("Software supply chain and release integrity", 15, [
      control("owner-code-gate", Boolean(ownerWorkflow), ".github/workflows/hercules-owner-code.yml"),
      control("provenance-gate", Boolean(provenanceWorkflow), ".github/workflows/provenance-gate.yml"),
      control("workflow-actions-sha-pinned", pinnedActions, ".github/workflows/*"),
      control("signed-release-attestation", signedReleaseEvidence, ".github/workflows/hercules-release-evidence.yml"),
      control("spdx-sbom-generation", sbomImplemented, "scripts/release-evidence.mjs"),
      control("hurc-compiler-checksum-pin", /sha256sum -c -/.test(hurcWorkflow), ".github/workflows/hurc-contract.yml"),
    ]),
    scoreDomain("Platform control plane and deployment", 15, [
      control("forge-control-api", await exists("hercules-forge/control-api.mjs"), "hercules-forge/control-api.mjs"),
      control("production-entrypoint", await exists("hercules-forge/production.mjs"), "hercules-forge/production.mjs"),
      control(
        "verified-remote-deployment-bridge",
        await exists("hercules-forge/deployment.mjs") &&
          await exists("tests/hercules-forge-deployment.test.mjs"),
        "hercules-forge/deployment.mjs + tests/hercules-forge-deployment.test.mjs",
      ),
      control("release-and-rollback-tests", await exists("tests/hercules-forge-production.test.mjs"), "tests/hercules-forge-production.test.mjs"),
      control("isolated-staging-plane", await exists("staging-plane/compose.yml"), "staging-plane/compose.yml"),
      control("machine-readable-public-api-contract", await exists("docs/openapi/hercules-forge-v1.yaml"), "docs/openapi/hercules-forge-v1.yaml"),
    ]),
    scoreDomain("Recovery and continuity", 12, [
      control("database-backup", /pg_dump/.test(stagingScript), "scripts/staging-plane.mjs"),
      control("database-restore-test", /restore-test/.test(stagingScript) && /pg_restore/.test(stagingScript), "scripts/staging-plane.mjs"),
      control("dependency-recovery-drill", Boolean(recoveryWorkflow), ".github/workflows/hercules-staging-recovery-drill.yml"),
      control("regional-failover-evidence", await exists("benchmarks/recovery/regional-failover.json"), "benchmarks/recovery/regional-failover.json"),
    ]),
    scoreDomain("Observability and SRE", 12, [
      control("slo-policy", await exists("observability/slo-baseline.json"), "observability/slo-baseline.json"),
      control("sampled-slo-workflow", Boolean(sloWorkflow), ".github/workflows/hercules-slo-evidence.yml"),
      control("staging-performance-evidence", stagingLoad.passed === true, "benchmarks/performance/staging-load.json"),
      control("continuous-production-telemetry", await exists("observability/production-telemetry.json"), "observability/production-telemetry.json"),
    ]),
    scoreDomain("Scalability and performance", 12, [
      control("staging-load-pass", stagingLoad.passed === true, "benchmarks/performance/staging-load.json"),
      control("staging-soak-pass", stagingSoak?.passed === true, "benchmarks/performance/staging-soak.json"),
      control("post-load-database-verification", /Verify database after sustained load/.test(globalWorkflow), ".github/workflows/hercules-global-staging-benchmark.yml"),
      control("production-workload-evidence", await exists("benchmarks/performance/production-workload.json"), "benchmarks/performance/production-workload.json"),
      control("multi-region-performance-evidence", await exists("benchmarks/performance/multi-region.json"), "benchmarks/performance/multi-region.json"),
    ]),
    scoreDomain("AI, browser, and sandbox execution", 10, [
      control("model-plane-tests", await exists("tests/hercules-models.test.mjs"), "tests/hercules-models.test.mjs"),
      control("native-guard-tests", await exists("tests/hercules-native-guard.test.mjs"), "tests/hercules-native-guard.test.mjs"),
      control("browser-boundary-tests", await exists("tests/hercules-hurc-browser.test.mjs"), "tests/hercules-hurc-browser.test.mjs"),
      control("hardened-arbitrary-code-sandbox", await exists("benchmarks/security/sandbox-isolation.json"), "benchmarks/security/sandbox-isolation.json"),
    ]),
    scoreDomain("Identity, tenant, and data security", 8, [
      control("explicit-hardened-scrypt", /version:\s*"scrypt-v2"/.test(identity) && /N:\s*2 \*\* 15/.test(identity), "hercules-forge/identity.mjs"),
      control("legacy-hash-auto-upgrade", /startsWith\("scrypt-v1\$"\)/.test(identity), "hercules-forge/identity.mjs"),
      control("csrf-enforcement", /requireCsrf/.test(controlApi), "hercules-forge/control-api.mjs"),
      control("security-response-headers", /strict-transport-security/.test(controlApi) && /permissions-policy/.test(controlApi), "hercules-forge/control-api.mjs"),
      control("security-baseline-gate", Boolean(securityWorkflow), ".github/workflows/hercules-security-baseline.yml"),
      control("codeql-static-analysis", /github\/codeql-action\/analyze@[0-9a-f]{40}/.test(codeqlWorkflow), ".github/workflows/hercules-codeql.yml"),
      control("formal-threat-model", await exists("docs/HERCULES-THREAT-MODEL.md"), "docs/HERCULES-THREAT-MODEL.md"),
      control("independent-penetration-test", await exists("assurance/independent-penetration-test.json"), "assurance/independent-penetration-test.json"),
    ]),
    scoreDomain("Operational automation", 6, [
      control("owner-code-ci", Boolean(ownerWorkflow), ".github/workflows/hercules-owner-code.yml"),
      control("security-ci", Boolean(securityWorkflow), ".github/workflows/hercules-security-baseline.yml"),
      control("recovery-ci", Boolean(recoveryWorkflow), ".github/workflows/hercules-staging-recovery-drill.yml"),
      control("slo-ci", Boolean(sloWorkflow), ".github/workflows/hercules-slo-evidence.yml"),
      control("release-evidence-ci", Boolean(releaseWorkflow), ".github/workflows/hercules-release-evidence.yml"),
    ]),
    scoreDomain("Compliance and independent assurance", 5, [
      control("canonical-provenance-policy", await exists("IP_PROVENANCE.md"), "IP_PROVENANCE.md"),
      control("vulnerability-policy", await exists("SECURITY.md"), "SECURITY.md"),
      control("signed-sbom-release-gate", signedReleaseEvidence && sbomImplemented, ".github/workflows/hercules-release-evidence.yml"),
      control("external-control-attestation", await exists("assurance/external-control-attestation.json"), "assurance/external-control-attestation.json"),
    ]),
    scoreDomain("Developer delivery experience", 5, [
      control("substantive-readme", readme.length > 500, "README.md"),
      control("contributing-contract", await exists("CONTRIBUTING.md"), "CONTRIBUTING.md"),
      control("codeowners", await exists(".github/CODEOWNERS"), ".github/CODEOWNERS"),
      control("openapi-contract", await exists("docs/openapi/hercules-forge-v1.yaml"), "docs/openapi/hercules-forge-v1.yaml"),
      control("changelog", await exists("CHANGELOG.md"), "CHANGELOG.md"),
    ]),
  ];

  const {score, exactScore} = calculateEvidenceScore(domains);

  return {
    schema: "sauceapproved.hercules.global-infrastructure-benchmark",
    version: 2,
    benchmark: "Hercules Evidence-Derived Infrastructure Benchmark",
    asOf: new Date().toISOString(),
    score,
    exactScore,
    classification: classification(score),
    scoringPolicy: {
      evidenceDerived: true,
      rule: "Each domain score is the percentage of named machine-verifiable controls that pass. Missing evidence receives zero credit.",
      weightsTotal: 100,
    },
    domains,
    stagingEvidence: {
      scope: "isolated-loopback-staging",
      profile: stagingLoad.profile,
      requests: stagingLoad.metrics.requests,
      errorRate: stagingLoad.metrics.errorRate,
      p95LatencyMs: stagingLoad.metrics.latencyMs.p95,
      p99LatencyMs: stagingLoad.metrics.latencyMs.p99,
      throughputRps: stagingLoad.metrics.throughputRps,
      soakPassed: stagingSoak?.passed === true,
    },
    agenticCapabilityCoverage: {
      score: null,
      status: "excluded_from_infrastructure_score",
      warning: "The legacy 37/40 capability rubric is not machine-derived and is not used as infrastructure maturity evidence.",
    },
    warning:
      "Controlled staging evidence is not production-scale, multi-region operating history, independent penetration testing, or independent cryptographic assurance.",
  };
}

async function main() {
  const output = await collectBenchmark();
  await writeFile(
    join(root, "benchmarks/global-infrastructure-result-current.json"),
    JSON.stringify(output, null, 2) + "\n",
  );
  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
