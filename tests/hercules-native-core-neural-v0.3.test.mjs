import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {buildCoreNeuralCandidate} from "../hercules-training/bootstrap-core-neural-v0.3.mjs";
import {trainTokenizer} from "../hercules-training/native-tokenizer.mjs";
import {
  generateNeuralText,
  trainNeuralLanguageModel,
} from "../hercules-training/native-neural-language-model.mjs";

const sourceCommit = "a".repeat(40);
const createdAt = "2026-09-23T23:30:00Z";

test("Core neural v0.3 trains deterministically and clears candidate gate", async () => {
  const [trainingText, evaluationText] = await Promise.all([
    readFile("hercules-training/bootstrap/language-foundation-train.jsonl", "utf8"),
    readFile("hercules-training/bootstrap/language-foundation-eval.jsonl", "utf8"),
  ]);

  const first = buildCoreNeuralCandidate({trainingText, evaluationText, sourceCommit, createdAt});
  const second = buildCoreNeuralCandidate({trainingText, evaluationText, sourceCommit, createdAt});

  assert.equal(first.ok, true);
  assert.equal(first.candidateReady, true);
  assert.equal(
    first.checkpoint.checkpoint.artifactSha256,
    second.checkpoint.checkpoint.artifactSha256,
  );
  assert.ok(first.evaluation.result.metrics["top1-accuracy"] >= 0.3);
  assert.ok(first.evaluation.result.metrics["cross-entropy-ratio"] <= 0.95);
  assert.ok(first.evaluation.result.metrics["token-coverage"] >= 0.8);
  assert.ok(first.evaluation.result.metrics["training-loss-reduction"] >= 0.2);
});

test("native neural generation is deterministic for the same trained checkpoint", () => {
  const texts = [
    "Hercules validates checkpoints.",
    "Hercules validates releases.",
    "Hercules records evidence.",
  ];
  const tokenizer = trainTokenizer(texts, {maxVocabulary: 64});
  const model = trainNeuralLanguageModel(tokenizer, texts, {
    embeddingDim: 6,
    seed: 7,
    epochs: 3,
    learningRate: 0.03,
  });

  const first = generateNeuralText(tokenizer, model, "Hercules ", {maxTokens: 8});
  const second = generateNeuralText(tokenizer, model, "Hercules ", {maxTokens: 8});
  assert.deepEqual(first, second);
});
