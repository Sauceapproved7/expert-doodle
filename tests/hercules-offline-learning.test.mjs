import test from "node:test";
import assert from "node:assert/strict";
import {
  validateExperience,
  scoreExperience,
  evaluateCandidateAction,
} from "../hercules-training/offline-learning.mjs";

const base = {
  id: "exp-build-001",
  state: {task: "deploy", environment: "staging"},
  action: {type: "run-tests", target: "staging"},
  outcome: {success: true, testsPassed: 42, testsFailed: 0},
  reward: {quality: 0.9, reliability: 1, safety: 1},
  source: {kind: "observed", evidenceSha256: "a".repeat(64)},
  createdAt: "2026-10-03T13:30:00Z",
};

test("experience validation fails closed without evidence or bounded rewards", () => {
  assert.equal(validateExperience(base).ok, true);
  assert.equal(validateExperience({...base, source: {kind: "observed"}}).ok, false);
  assert.equal(validateExperience({...base, reward: {...base.reward, safety: 1.1}}).ok, false);
});

test("experience scoring makes safety a hard gate", () => {
  assert.equal(scoreExperience(base).eligible, true);
  const unsafe = scoreExperience({...base, reward: {...base.reward, safety: 0.4}});
  assert.equal(unsafe.eligible, false);
  assert.equal(unsafe.score, 0);
});

test("candidate actions require dataset support and never authorize production", () => {
  const supported = evaluateCandidateAction({
    candidate: {type: "run-tests", target: "staging"},
    experiences: [base],
    minimumSupport: 1,
  });
  assert.equal(supported.ok, true);
  assert.equal(supported.mode, "recommendation-only");

  const ood = evaluateCandidateAction({
    candidate: {type: "delete-production", target: "production"},
    experiences: [base],
    minimumSupport: 1,
  });
  assert.equal(ood.ok, false);
  assert.match(ood.reasons.join(" "), /support/i);

  const production = evaluateCandidateAction({
    candidate: {type: "run-tests", target: "production"},
    experiences: [{...base, action: {type: "run-tests", target: "production"}}],
    minimumSupport: 1,
  });
  assert.equal(production.ok, false);
  assert.match(production.reasons.join(" "), /production/i);
});
