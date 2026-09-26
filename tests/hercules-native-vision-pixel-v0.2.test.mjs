import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {buildVisionPixelCandidate} from "../hercules-training/bootstrap-vision-pixel-v0.2.mjs";
import {
  classifyVisionPixels,
  decodePixelSample,
  trainVisionPixelClassifier,
} from "../hercules-training/native-vision-pixel.mjs";

const sourceCommit = "a".repeat(40);
const createdAt = "2026-09-26T21:30:00Z";

function parseJsonl(text) {
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

test("Vision Pixel v0.2 is deterministic and clears the noisy held-out gate", async () => {
  const [trainingText, evaluationText] = await Promise.all([
    readFile("hercules-training/bootstrap/vision-pixel-v0.2-train.jsonl", "utf8"),
    readFile("hercules-training/bootstrap/vision-pixel-v0.2-eval.jsonl", "utf8"),
  ]);

  const first = buildVisionPixelCandidate({
    trainingText,
    evaluationText,
    sourceCommit,
    createdAt,
  });
  const second = buildVisionPixelCandidate({
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
  assert.ok(first.evaluation.result.metrics.accuracy >= 0.9);
  assert.ok(first.evaluation.result.metrics["min-class-recall"] >= 0.8);
  assert.ok(first.evaluation.result.metrics["baseline-improvement"] >= 0.65);
});

test("Vision Pixel v0.2 classifies held-out raster pixels rather than text labels", async () => {
  const [trainingText, evaluationText] = await Promise.all([
    readFile("hercules-training/bootstrap/vision-pixel-v0.2-train.jsonl", "utf8"),
    readFile("hercules-training/bootstrap/vision-pixel-v0.2-eval.jsonl", "utf8"),
  ]);
  const training = parseJsonl(trainingText);
  const evaluation = parseJsonl(evaluationText);
  const model = trainVisionPixelClassifier(training, {
    hiddenDim: 12,
    epochs: 48,
    learningRate: 0.04,
    seed: 59,
    initScale: 0.08,
  });

  const sample = evaluation.find((row) => row.label === "box");
  const input = {...sample};
  delete input.label;
  const prediction = classifyVisionPixels(model, input);
  assert.equal(prediction.label, "box");
  assert.ok(prediction.confidence > 0.5);
});

test("Vision Pixel decoder rejects malformed rasters", () => {
  assert.throws(
    () => decodePixelSample({width: 12, height: 12, pixels: "0101"}),
    /width\*height binary pixels/,
  );
});
