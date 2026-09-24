import {readFile, writeFile} from "node:fs/promises";

const result = JSON.parse(
  await readFile("benchmarks/performance/staging-load.json", "utf8"),
);

if (
  !result.passed ||
  result.target?.origin !== "http://127.0.0.1:38080" ||
  result.guardrails?.fixtureOnly !== true
) {
  throw new Error("verified_staging_result_required");
}

const stagingEvidence = {
  profile: result.profile,
  requests: result.metrics.requests,
  errorRate: result.metrics.errorRate,
  p50LatencyMs: result.metrics.latencyMs.p50,
  p95LatencyMs: result.metrics.latencyMs.p95,
  p99LatencyMs: result.metrics.latencyMs.p99,
  throughputRps: result.metrics.throughputRps,
  fixtureOnly: true,
  loopbackOnly: result.guardrails?.loopbackOnly === true,
};

const output = {
  benchmark: "Hercules Global Infrastructure Evidence",
  schemaVersion: 2,
  asOf: new Date().toISOString(),
  score: null,
  exactScore: null,
  classification: "verified isolated-staging evidence; global maturity score withheld",
  scoring: {
    status: "withheld",
    reason:
      "Global maturity must be calculated from machine-verifiable domain controls and independent evidence. Hardcoded domain scores are retired.",
    legacyFixedScoreRetired: true,
  },
  stagingEvidence,
  claims: {
    productionScale: false,
    multiRegion: false,
    independentAssurance: false,
    productionSlo: false,
  },
  warning:
    "Passing isolated staging evidence is not production-scale, multi-region, or independent operating proof.",
};

await writeFile(
  "benchmarks/global-infrastructure-result-current.json",
  JSON.stringify(output, null, 2) + "\n",
);
console.log(JSON.stringify(output, null, 2));
