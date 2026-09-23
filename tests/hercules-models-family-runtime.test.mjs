import test from "node:test";
import assert from "node:assert/strict";
import {
  HERCULES_FAMILY_CLASSIFIER_CHECKPOINTS,
  HerculesEmbeddedFamilyClassifier,
} from "../hercules-models/embedded-family-classifier.mjs";

test("five embedded family runtimes reproduce attested checkpoints", async () => {
  for (const modelId of Object.keys(HERCULES_FAMILY_CLASSIFIER_CHECKPOINTS).sort()) {
    const runtime = await HerculesEmbeddedFamilyClassifier.load(modelId);
    assert.equal(runtime.modelId, modelId);
  }
});

test("five embedded family runtimes serve declared v0.1 control capabilities", async () => {
  const core = await HerculesEmbeddedFamilyClassifier.load("hercules-core");
  assert.equal(core.infer("rewrite and shorten this draft", {task: "general"}).route, "transform");

  const coder = await HerculesEmbeddedFamilyClassifier.load("hercules-coder");
  assert.equal(coder.infer("debug this crashing function", {task: "code"}).route, "debug");

  const vision = await HerculesEmbeddedFamilyClassifier.load("hercules-vision");
  assert.equal(vision.infer("ocr and read this screenshot", {task: "vision"}).route, "ocr");

  const voice = await HerculesEmbeddedFamilyClassifier.load("hercules-voice");
  assert.equal(
    voice.infer("read this script aloud", {task: "text-to-speech"}).route,
    "synthesize",
  );
  assert.equal(
    voice.infer("transcribe this recording", {task: "speech-to-text"}).route,
    "transcribe",
  );

  const research = await HerculesEmbeddedFamilyClassifier.load("hercules-research");
  assert.equal(
    research.infer("verify and fact check this claim", {task: "research"}).route,
    "verify",
  );
});

test("family runtimes reject unsupported tasks", async () => {
  const coder = await HerculesEmbeddedFamilyClassifier.load("hercules-coder");
  assert.throws(
    () => coder.infer("explain this", {task: "general"}),
    /does not support task/,
  );
});
