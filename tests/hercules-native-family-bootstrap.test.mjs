import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {buildNativeFamilyBaselines} from "../hercules-training/bootstrap-family-models.mjs";
import {
  predictBootstrapClassifier,
  rankBootstrapRetriever,
} from "../hercules-training/native-bootstrap-models.mjs";

const sourceCommit = "a".repeat(40);
const createdAt = "2026-09-23T21:15:00Z";

async function build() {
  const configText = await readFile(
    "hercules-training/bootstrap/family-bootstrap.json",
    "utf8",
  );
  return buildNativeFamilyBaselines({configText, sourceCommit, createdAt});
}

test("seven missing Hercules families produce deterministic native bootstrap checkpoints", async () => {
  const first = await build();
  const second = await build();

  assert.equal(first.ok, true);
  assert.equal(first.builds.length, 7);
  assert.equal(second.builds.length, 7);

  for (let index = 0; index < first.builds.length; index += 1) {
    const a = first.builds[index];
    const b = second.builds[index];
    assert.equal(a.family, b.family);
    assert.equal(
      a.checkpoint.checkpoint.artifactSha256,
      b.checkpoint.checkpoint.artifactSha256,
    );
    assert.ok(a.evaluation.result.metrics.accuracy >= 0.8);
    assert.ok(a.evaluation.result.metrics["error-rate"] <= 0.2);
    assert.equal(a.candidate.origin, "hercules-native");
    assert.equal(a.candidate.state, "candidate");
    assert.match(a.candidate.checkpoint, /^sha256:[a-f0-9]{64}$/);
    assert.equal(a.candidate.runtime.kind, "embedded");
  }
});

test("bootstrap family models perform their declared narrow control capabilities", async () => {
  const result = await build();
  const byFamily = Object.fromEntries(
    result.builds.map((entry) => [entry.family, entry]),
  );

  assert.equal(
    predictBootstrapClassifier(byFamily["hercules-core"].model, "rewrite and shorten this draft"),
    "transform",
  );
  assert.equal(
    predictBootstrapClassifier(byFamily["hercules-coder"].model, "fix this crashing error"),
    "debug",
  );
  assert.equal(
    predictBootstrapClassifier(byFamily["hercules-vision"].model, "ocr and read the text in this scan"),
    "ocr",
  );
  assert.equal(
    predictBootstrapClassifier(byFamily["hercules-voice"].model, "read this paragraph aloud as speech"),
    "synthesize",
  );
  assert.equal(
    predictBootstrapClassifier(byFamily["hercules-research"].model, "verify and fact check this claim"),
    "verify",
  );
  assert.equal(
    predictBootstrapClassifier(byFamily["hercules-guard"].model, "permanently delete the production database"),
    "destructive",
  );

  const ranked = rankBootstrapRetriever(
    byFamily["hercules-retrieval"].model,
    "dataset provenance checkpoints evaluation activation training evidence",
    {limit: 1},
  );
  assert.equal(ranked[0].id, "training");
});

test("bootstrap evidence is explicitly capability-limited instead of claiming flagship completion", async () => {
  const result = await build();
  const vision = result.builds.find((entry) => entry.family === "hercules-vision");
  const voice = result.builds.find((entry) => entry.family === "hercules-voice");
  const retrieval = result.builds.find((entry) => entry.family === "hercules-retrieval");

  assert.match(vision.candidate.description, /does not inspect pixels/i);
  assert.match(voice.candidate.description, /does not decode or synthesize audio/i);
  assert.match(retrieval.candidate.description, /TF-IDF/i);
  assert.equal(vision.capability, "visual-request-intent-routing");
  assert.equal(voice.capability, "voice-request-intent-routing");
  assert.equal(retrieval.capability, "lexical-document-ranking");
});
