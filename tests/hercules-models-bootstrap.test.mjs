import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {HERCULES_BOOTSTRAP_CANDIDATES} from "../hercules-models/bootstrap-catalog.mjs";
import {HerculesEmbeddedFamilyBootstrap} from "../hercules-models/embedded-family-bootstrap.mjs";
import {validateModelManifest} from "../hercules-models/schema.mjs";

test("seven attested native bootstrap candidates cover the seven non-agent families", async () => {
  assert.equal(HERCULES_BOOTSTRAP_CANDIDATES.length, 7);
  const families = new Set();

  for (const model of HERCULES_BOOTSTRAP_CANDIDATES) {
    const checked = validateModelManifest(model);
    assert.equal(checked.ok, true, checked.errors.join("; "));
    assert.equal(model.origin, "hercules-native");
    assert.equal(model.state, "candidate");
    assert.equal(model.runtime.kind, "embedded");
    assert.match(model.checkpoint, /^sha256:[a-f0-9]{64}$/);
    families.add(model.family);
  }

  assert.deepEqual(
    [...families].sort(),
    [
      "hercules-coder",
      "hercules-core",
      "hercules-guard",
      "hercules-research",
      "hercules-retrieval",
      "hercules-vision",
      "hercules-voice",
    ],
  );

  const attestation = JSON.parse(await readFile(
    "hercules-models/attestations/hercules-family-bootstrap-v0.1.json",
    "utf8",
  ));
  assert.equal(attestation.models.length, 7);
  assert.match(attestation.workflowArtifactDigest, /^sha256:[a-f0-9]{64}$/);

  for (const model of HERCULES_BOOTSTRAP_CANDIDATES) {
    const attested = attestation.models.find((item) => item.modelId === model.id);
    assert.ok(attested, "missing attestation for " + model.id);
    assert.equal("sha256:" + attested.checkpointSha256, model.checkpoint);
    assert.equal(attested.evaluation.passed, true);
    assert.ok(attested.evaluation.accuracy >= 0.8);
  }
});

test("embedded family bootstrap runtime reproduces every attested checkpoint", async () => {
  for (const candidate of HERCULES_BOOTSTRAP_CANDIDATES) {
    const runtime = await HerculesEmbeddedFamilyBootstrap.load(candidate.id);
    assert.equal(runtime.manifest.id, candidate.id);
    assert.equal(runtime.manifest.checkpoint, candidate.checkpoint);
  }
});

test("embedded family bootstrap runtime serves declared narrow capabilities", async () => {
  const core = await HerculesEmbeddedFamilyBootstrap.load("hercules-core-bootstrap");
  assert.equal(core.infer("rewrite and shorten this message").label, "transform");

  const coder = await HerculesEmbeddedFamilyBootstrap.load("hercules-coder-bootstrap");
  assert.equal(coder.infer("fix this crashing error").label, "debug");

  const vision = await HerculesEmbeddedFamilyBootstrap.load("hercules-vision-bootstrap");
  assert.equal(vision.infer("ocr and read this screenshot text").label, "ocr");

  const voice = await HerculesEmbeddedFamilyBootstrap.load("hercules-voice-bootstrap");
  assert.equal(voice.infer("read this script aloud as speech").label, "synthesize");

  const research = await HerculesEmbeddedFamilyBootstrap.load("hercules-research-bootstrap");
  assert.equal(research.infer("verify and fact check this claim").label, "verify");

  const guard = await HerculesEmbeddedFamilyBootstrap.load("hercules-guard-bootstrap");
  assert.equal(guard.infer("permanently delete the production database").label, "destructive");

  const retrieval = await HerculesEmbeddedFamilyBootstrap.load("hercules-retrieval-bootstrap");
  const ranked = retrieval.infer({
    query: "dataset provenance checkpoints evaluation activation training evidence",
    limit: 1,
  });
  assert.equal(ranked.results[0].id, "training");
});
