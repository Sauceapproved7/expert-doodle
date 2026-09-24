import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {buildLanguageFoundation} from "../hercules-training/bootstrap-language-foundation.mjs";
import {
  decode,
  encode,
  trainTokenizer,
} from "../hercules-training/native-tokenizer.mjs";
import {
  generateText,
  trainNextTokenModel,
} from "../hercules-training/native-language-model.mjs";

const sourceCommit = "a".repeat(40);
const createdAt = "2026-09-23T23:00:00Z";

test("native tokenizer preserves known owner-authored text", () => {
  const texts = [
    "Hercules validates model checkpoints.",
    "Hercules records training evidence.",
  ];
  const tokenizer = trainTokenizer(texts);
  const encoded = encode(tokenizer, texts[0]);
  assert.equal(decode(tokenizer, encoded), texts[0]);
});

test("language foundation trains deterministically and clears candidate gate", async () => {
  const [trainingText, evaluationText] = await Promise.all([
    readFile("hercules-training/bootstrap/language-foundation-train.jsonl", "utf8"),
    readFile("hercules-training/bootstrap/language-foundation-eval.jsonl", "utf8"),
  ]);

  const first = buildLanguageFoundation({trainingText, evaluationText, sourceCommit, createdAt});
  const second = buildLanguageFoundation({trainingText, evaluationText, sourceCommit, createdAt});

  assert.equal(first.ok, true);
  assert.equal(first.candidateReady, true);
  assert.equal(
    first.checkpoint.checkpoint.artifactSha256,
    second.checkpoint.checkpoint.artifactSha256,
  );
  assert.ok(first.evaluation.result.metrics["top1-accuracy"] >= 0.35);
  assert.ok(first.evaluation.result.metrics["cross-entropy-ratio"] <= 0.85);
  assert.ok(first.evaluation.result.metrics["token-coverage"] >= 0.8);
});

test("native language model generates deterministic continuation", () => {
  const texts = [
    "Hercules validates checkpoints.",
    "Hercules validates releases.",
    "Hercules records evidence.",
  ];
  const tokenizer = trainTokenizer(texts);
  const model = trainNextTokenModel(tokenizer, texts);
  const first = generateText(tokenizer, model, "Hercules ", {maxTokens: 8});
  const second = generateText(tokenizer, model, "Hercules ", {maxTokens: 8});
  assert.deepEqual(first, second);
  assert.ok(first.continuation.length > 0);
});
