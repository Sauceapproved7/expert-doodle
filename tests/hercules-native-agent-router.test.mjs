import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {buildNativeAgentRouter} from "../hercules-training/bootstrap-agent-router.mjs";
import {
  evaluateAgentRouter,
  predictAgentRouter,
  trainAgentRouter,
} from "../hercules-training/native-agent-router.mjs";

const sourceCommit = "a".repeat(40);

test("native agent router trains deterministically from Hercules-authored examples", async () => {
  const [trainText, evalText] = await Promise.all([
    readFile("hercules-training/bootstrap/agent-routing-train.jsonl", "utf8"),
    readFile("hercules-training/bootstrap/agent-routing-eval.jsonl", "utf8"),
  ]);

  const first = buildNativeAgentRouter({
    trainText,
    evalText,
    sourceCommit,
    createdAt: "2026-09-23T20:30:00Z",
  });
  const second = buildNativeAgentRouter({
    trainText,
    evalText,
    sourceCommit,
    createdAt: "2026-09-23T20:30:00Z",
  });

  assert.equal(first.ok, true);
  assert.equal(first.checkpoint.checkpoint.artifactSha256, second.checkpoint.checkpoint.artifactSha256);
  assert.ok(first.evaluation.result.metrics.accuracy >= 0.8);
  assert.ok(first.evaluation.result.metrics["error-rate"] <= 0.2);
  assert.equal(first.decision.activatedModel.origin, "hercules-native");
  assert.equal(first.decision.activatedModel.state, "active");
});

test("native agent router classifies representative intents", () => {
  const examples = [
    {label: "code", text: "fix the javascript function and add tests"},
    {label: "research", text: "research current documentation with sources"},
    {label: "vision", text: "inspect the screenshot and image"},
    {label: "speech", text: "transcribe the audio recording"},
    {label: "general", text: "explain the concept and make a plan"},
  ];

  const model = trainAgentRouter(examples);
  const evaluation = evaluateAgentRouter(model, examples);
  assert.equal(evaluation.accuracy, 1);
  assert.equal(predictAgentRouter(model, "debug this code function"), "code");
  assert.equal(predictAgentRouter(model, "transcribe this audio"), "speech");
});
