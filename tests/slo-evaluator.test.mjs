import assert from "node:assert/strict";
import test from "node:test";
import {evaluateSlo} from "../scripts/evaluate-slo.mjs";

const config={
  schemaVersion:1,
  scope:"isolated-loopback-staging",
  objectives:{availability:{goodRequestRatioMin:0.999},latency:{p95MsMax:500,p99MsMax:1000}},
  evidenceRequirements:{minDistinctUtcDays:30,minWindows:30,minTotalDurationSeconds:27000},
  claims:{productionSlo:false,continuousTelemetry:false}
};

function window(overrides={}){
  return {
    profile:"soak",
    target:{method:"GET"},
    guardrails:{fixtureOnly:true,loopbackOnly:true},
    startedAt:"2026-09-22T00:00:00.000Z",
    completedAt:"2026-09-22T00:15:00.000Z",
    durationMs:900000,
    metrics:{requests:100000,passed:100000,errors:0,latencyMs:{p95:10,p99:20}},
    ...overrides
  };
}

test("reports passing evidence without inventing long-duration attainment",()=>{
  const result=evaluateSlo(config,[window()]);
  assert.equal(result.status,"passing_insufficient_history");
  assert.equal(result.objectives.availability.met,true);
  assert.equal(result.evidenceCoverage.historyMature,false);
  assert.equal(result.productionSlo,false);
});

test("reports an objective breach when the error budget is exhausted",()=>{
  const evidence=window({metrics:{requests:1000,passed:990,errors:10,latencyMs:{p95:10,p99:20}}});
  const result=evaluateSlo(config,[evidence]);
  assert.equal(result.status,"breached");
  assert.equal(result.objectives.availability.met,false);
  assert.ok(result.objectives.availability.budgetConsumedRatio>1);
});

test("rejects evidence outside the isolated read-only staging boundary",()=>{
  const evidence=window({guardrails:{fixtureOnly:false,loopbackOnly:true}});
  assert.throws(()=>evaluateSlo(config,[evidence]),/unsafe_or_unscoped_evidence/);
});
