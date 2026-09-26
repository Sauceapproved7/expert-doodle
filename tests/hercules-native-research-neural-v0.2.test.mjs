import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {buildResearchNeuralCandidate} from "../hercules-training/bootstrap-research-neural-v0.2.mjs";

const sourceCommit = "a".repeat(40);
const createdAt = "2026-09-26T21:00:00Z";

test("Research Neural v0.2 is deterministic and clears its held-out candidate gate", async () => {
  const [trainingText, evaluationText] = await Promise.all([
    readFile("hercules-training/bootstrap/research-neural-v0.2-train.jsonl", "utf8"),
    readFile("hercules-training/bootstrap/research-neural-v0.2-eval.jsonl", "utf8"),
  ]);

  const first = buildResearchNeuralCandidate({
    trainingText,
    evaluationText,
    sourceCommit,
    createdAt,
  });
  const second = buildResearchNeuralCandidate({
    trainingText,
    evaluationText,
    sourceCommit,
    createdAt,
  });

  assert.equal(first.ok, true);
  assert.equal(first.candidateReady, true);
  assert.equal(
    first.checkpoint.checkpoint.artifactSha256,
    second.checkpoint.checkpoint.artifactSha256,
  );
  assert.ok(first.evaluation.result.metrics["top1-accuracy"] >= 0.4);
  assert.ok(first.evaluation.result.metrics["content-top1-accuracy"] >= 0.1);
  assert.ok(first.evaluation.result.metrics["unigram-improvement"] >= 0.1);
  assert.ok(
    first.evaluation.result.metrics["backoff-cross-entropy-ratio"] <= 1.4,
  );
  assert.ok(first.evaluation.result.metrics["token-coverage"] >= 0.85);
});
