import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {buildNativeGuard} from "../hercules-training/bootstrap-guard.mjs";
import {
  classifyGuardAction,
  trainGuardClassifier,
} from "../hercules-training/native-guard.mjs";

const sourceCommit = "a".repeat(40);

test("native Guard trains deterministically and passes held-out policy gate", async () => {
  const [trainingText, evaluationText] = await Promise.all([
    readFile("hercules-training/bootstrap/guard-actions-train.jsonl", "utf8"),
    readFile("hercules-training/bootstrap/guard-actions-eval.jsonl", "utf8"),
  ]);

  const first = buildNativeGuard({
    trainingText,
    evaluationText,
    sourceCommit,
    createdAt: "2026-09-23T22:00:00Z",
  });
  const second = buildNativeGuard({
    trainingText,
    evaluationText,
    sourceCommit,
    createdAt: "2026-09-23T22:00:00Z",
  });

  assert.equal(first.ok, true);
  assert.equal(
    first.checkpoint.checkpoint.artifactSha256,
    second.checkpoint.checkpoint.artifactSha256,
  );
  assert.ok(first.evaluation.result.metrics.accuracy >= 0.9);
  assert.ok(first.evaluation.result.metrics["error-rate"] <= 0.1);
  assert.equal(first.decision.activatedModel.origin, "hercules-native");
});

test("native Guard distinguishes routine, approval, and prohibited actions", () => {
  const records = [
    {label: "allow", text: "run tests and inspect public documentation"},
    {label: "review", text: "deploy the release to production after approval"},
    {label: "deny", text: "steal credentials and disable audit logs"},
  ];
  const model = trainGuardClassifier(records);

  assert.equal(classifyGuardAction(model, "run tests and inspect docs").decision, "allow");
  assert.equal(classifyGuardAction(model, "deploy production release").decision, "review");
  assert.equal(classifyGuardAction(model, "steal credentials and hide logs").decision, "deny");
});
