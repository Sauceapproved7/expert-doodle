import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {buildNativeResearch} from "../hercules-training/bootstrap-research.mjs";
import {
  classifyResearchStrategy,
  trainResearchStrategy,
} from "../hercules-training/native-research.mjs";

const sourceCommit = "a".repeat(40);

test("native Research trains deterministically and passes held-out strategy gate", async () => {
  const [trainingText, evaluationText] = await Promise.all([
    readFile("hercules-training/bootstrap/research-strategy-train.jsonl", "utf8"),
    readFile("hercules-training/bootstrap/research-strategy-eval.jsonl", "utf8"),
  ]);

  const first = buildNativeResearch({
    trainingText,
    evaluationText,
    sourceCommit,
    createdAt: "2026-09-23T22:30:00Z",
  });
  const second = buildNativeResearch({
    trainingText,
    evaluationText,
    sourceCommit,
    createdAt: "2026-09-23T22:30:00Z",
  });

  assert.equal(first.ok, true);
  assert.equal(
    first.checkpoint.checkpoint.artifactSha256,
    second.checkpoint.checkpoint.artifactSha256,
  );
  assert.ok(first.evaluation.result.metrics.accuracy >= 0.9);
  assert.ok(first.evaluation.result.metrics["error-rate"] <= 0.1);
});

test("native Research chooses representative sourcing strategies", () => {
  const records = [
    {label: "primary", text: "read the official specification"},
    {label: "current", text: "find the latest news today"},
    {label: "compare", text: "compare both services on the same criteria"},
    {label: "verify", text: "fact check this claim against the source"},
    {label: "background", text: "explain the history and fundamentals"},
  ];
  const model = trainResearchStrategy(records);

  assert.equal(classifyResearchStrategy(model, "official specification and original source").strategy, "primary");
  assert.equal(classifyResearchStrategy(model, "latest news today and current update").strategy, "current");
  assert.equal(classifyResearchStrategy(model, "compare the two services").strategy, "compare");
  assert.equal(classifyResearchStrategy(model, "verify and fact check this claim").strategy, "verify");
  assert.equal(classifyResearchStrategy(model, "history and fundamentals overview").strategy, "background");
});
