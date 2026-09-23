import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {buildFiveNativeFamilies} from "../hercules-training/bootstrap-five-native-families.mjs";
import {predictFamilyClassifier} from "../hercules-training/native-family-classifier.mjs";

const sourceCommit = "a".repeat(40);
const createdAt = "2026-09-23T22:20:00Z";

async function build() {
  const configText = await readFile(
    "hercules-training/bootstrap/five-family-classifiers.json",
    "utf8",
  );
  return buildFiveNativeFamilies({configText, sourceCommit, createdAt});
}

test("five remaining Hercules families train deterministically and clear activation gates", async () => {
  const first = await build();
  const second = await build();

  assert.equal(first.ok, true);
  assert.equal(first.builds.length, 5);

  for (let index = 0; index < first.builds.length; index += 1) {
    const a = first.builds[index];
    const b = second.builds[index];
    assert.equal(a.modelId, b.modelId);
    assert.equal(
      a.checkpoint.checkpoint.artifactSha256,
      b.checkpoint.checkpoint.artifactSha256,
    );
    assert.ok(a.evaluation.result.metrics.accuracy >= 0.8);
    assert.ok(a.evaluation.result.metrics["error-rate"] <= 0.2);
    assert.equal(a.decision.ok, true);
    assert.equal(a.decision.activatedModel.origin, "hercules-native");
    assert.equal(a.decision.activatedModel.state, "active");
  }
});

test("five family v0.1 checkpoints perform their declared control capabilities", async () => {
  const result = await build();
  const byId = Object.fromEntries(result.builds.map((build) => [build.modelId, build]));

  assert.equal(
    predictFamilyClassifier(byId["hercules-core"].model, "rewrite and shorten this draft"),
    "transform",
  );
  assert.equal(
    predictFamilyClassifier(byId["hercules-coder"].model, "debug this crashing function"),
    "debug",
  );
  assert.equal(
    predictFamilyClassifier(byId["hercules-vision"].model, "ocr and read this screenshot"),
    "ocr",
  );
  assert.equal(
    predictFamilyClassifier(byId["hercules-voice"].model, "read this script aloud"),
    "synthesize",
  );
  assert.equal(
    predictFamilyClassifier(byId["hercules-research"].model, "verify and fact check this claim"),
    "verify",
  );
});

test("vision and voice v0.1 remain explicitly control-scoped", async () => {
  const result = await build();
  const vision = result.builds.find((build) => build.modelId === "hercules-vision");
  const voice = result.builds.find((build) => build.modelId === "hercules-voice");

  assert.match(vision.description, /does not itself inspect pixels/i);
  assert.match(voice.description, /does not itself decode or synthesize audio/i);
});
