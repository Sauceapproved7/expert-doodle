import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateEvidenceScore,
  scoreDomain,
} from "../scripts/recalculate-global-infrastructure.mjs";

test("domain scores are derived only from named controls", () => {
  const domain = scoreDomain("example", 25, [
    {id:"a", passed:true, evidence:"a"},
    {id:"b", passed:false, evidence:"b"},
    {id:"c", passed:true, evidence:"c"},
    {id:"d", passed:false, evidence:"d"},
  ]);

  assert.equal(domain.score, 50);
  assert.equal(domain.passedControls, 2);
  assert.equal(domain.totalControls, 4);
});

test("weighted benchmark score is calculated from evidence-derived domain scores", () => {
  const domains = [
    scoreDomain("a", 50, [
      {id:"a1", passed:true, evidence:"a1"},
      {id:"a2", passed:true, evidence:"a2"},
    ]),
    scoreDomain("b", 50, [
      {id:"b1", passed:false, evidence:"b1"},
      {id:"b2", passed:false, evidence:"b2"},
    ]),
  ];

  assert.deepEqual(calculateEvidenceScore(domains), {
    exactScore: 50,
    score: 50,
  });
});

test("benchmark weights must total 100", () => {
  assert.throws(
    () => calculateEvidenceScore([
      scoreDomain("a", 99, [{id:"a", passed:true, evidence:"a"}]),
    ]),
    /weights must total 100/,
  );
});
