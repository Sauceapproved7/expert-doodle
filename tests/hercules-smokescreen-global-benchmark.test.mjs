import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SMOKESCREEN_BENCHMARK_CORPUS,
  runSmokeScreenGlobalBenchmark,
} from "../scripts/smokescreen-global-benchmark.mjs";

const key="0123456789abcdef0123456789abcdef";

test("global benchmark corpus includes benign, ambiguous, and hostile security traffic",()=>{
  const labels=new Set(DEFAULT_SMOKESCREEN_BENCHMARK_CORPUS.map((item)=>item.label));
  assert.ok(labels.has("benign"));
  assert.ok(labels.has("benign-ambiguous"));
  assert.ok(labels.has("hostile"));
  assert.ok(DEFAULT_SMOKESCREEN_BENCHMARK_CORPUS.length>=10);
});

test("SmokeScreen global benchmark meets fixture quality and safety thresholds",()=>{
  const result=runSmokeScreenGlobalBenchmark({
    hmacKey:key,
    iterations:100,
  });

  assert.equal(result.scope,"SYNTHETIC_FIXTURE_ONLY");
  assert.equal(result.metrics.falsePositiveDeceptionRate,0);
  assert.equal(result.metrics.hostileDetectionRate,1);
  assert.equal(result.metrics.hostileDeceptionRate,1);
  assert.equal(result.metrics.deceptionPrecision,1);
  assert.equal(result.metrics.safetyViolations,0);
  assert.ok(result.metrics.governorProtectedBenign>=1);
  assert.ok(result.metrics.latencyMs.p95<=10);
  assert.equal(result.passed,true);
});

test("benchmark never converts synthetic fixture results into production claims",()=>{
  const result=runSmokeScreenGlobalBenchmark({
    hmacKey:key,
    iterations:10,
  });

  assert.equal(result.productionDetectionRateClaim,false);
  assert.equal(result.externalPenetrationTestClaim,false);
  assert.equal(result.competitorPerformanceClaim,false);
});
