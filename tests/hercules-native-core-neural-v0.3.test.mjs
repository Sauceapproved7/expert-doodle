import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {buildCoreNeuralCandidate} from "../hercules-training/bootstrap-core-neural-v0.3.mjs";
import {trainTokenizer} from "../hercules-training/native-tokenizer.mjs";
import {
  generateNeuralText,
  trainNeuralNextTokenModel,
} from "../hercules-training/native-neural-language-model.mjs";

const sourceCommit = "a".repeat(40);
const createdAt = "2026-09-26T20:00:00Z";

test("neural next-token training is deterministic on a fixed seed", () => {
  const texts = [
    "Hercules validates checkpoints.",
    "Hercules validates releases.",
    "Hercules records evidence.",
  ];
  const tokenizer = trainTokenizer(texts);

  const first = trainNeuralNextTokenModel(tokenizer, texts, {
    contextLength: 2,
    embeddingDim: 6,
    epochs: 4,
    learningRate: 0.05,
    seed: 9,
  });
  const second = trainNeuralNextTokenModel(tokenizer, texts, {
    contextLength: 2,
    embeddingDim: 6,
    epochs: 4,
    learningRate: 0.05,
    seed: 9,
  });

  assert.deepEqual(first, second);
});

test("Core neural v0.3 clears its held-out candidate gate", async () => {
  const [trainingText, evaluationText] = await Promise.all([
    readFile("hercules-training/bootstrap/language-foundation-train.jsonl", "utf8"),
    readFile("hercules-training/bootstrap/language-foundation-eval.jsonl", "utf8"),
  ]);

  const build = buildCoreNeuralCandidate({
    trainingText,
    evaluationText,
    sourceCommit,
    createdAt,
  });

  assert.equal(build.ok, true);
  assert.equal(build.candidateReady, true);
  assert.ok(build.evaluation.result.metrics["top1-accuracy"] >= 0.3);
  assert.ok(build.evaluation.result.metrics["content-top1-accuracy"] >= 0.08);
  assert.ok(build.evaluation.result.metrics["unigram-improvement"] >= 0.05);
  assert.ok(
    build.evaluation.result.metrics["backoff-cross-entropy-ratio"] <= 1.35,
  );
  assert.ok(build.evaluation.result.metrics["token-coverage"] >= 0.8);
});

test("neural generation is deterministic for the same checkpoint", () => {
  const texts = [
    "Hercules validates checkpoints.",
    "Hercules validates releases.",
    "Hercules records evidence.",
  ];
  const tokenizer = trainTokenizer(texts);
  const model = trainNeuralNextTokenModel(tokenizer, texts, {
    contextLength: 2,
    embeddingDim: 6,
    epochs: 5,
    learningRate: 0.05,
    seed: 11,
  });

  assert.deepEqual(
    generateNeuralText(tokenizer, model, "Hercules ", {maxTokens: 10}),
    generateNeuralText(tokenizer, model, "Hercules ", {maxTokens: 10}),
  );
});
