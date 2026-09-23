import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {trainAgentRouter, evaluateAgentRouter} from "../hercules-training/native-agent-router.mjs";
import {
  validateDatasetManifest,
  validateTrainingJob,
  validateCheckpoint,
  validateEvaluationSuite,
  validateEvaluationResult,
} from "../hercules-training/schema.mjs";
import {scoreEvaluation} from "../hercules-training/evaluation.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("bootstrap dataset and evaluation bytes match recorded provenance", async () => {
  const trainText = await readFile("hercules-training/bootstrap/agent-router-train.json", "utf8");
  const evalText = await readFile("hercules-training/bootstrap/agent-router-eval.json", "utf8");
  assert.equal(
    sha256(trainText),
    "8df9e9fe54c923f02334175e1e3d315ff8be1bff43fdf26ae22d7ee5dbc0e8dd",
  );
  assert.equal(
    sha256(evalText),
    "2ee548907da0d6a9ffd9453e0eac99302ffe272ff38c3a0975329bd9972ce02c",
  );
});

test("bootstrap lineage manifests validate with their recorded fingerprints", async () => {
  const dataset = validateDatasetManifest(
    await json("hercules-training/bootstrap/agent-router-dataset-manifest.json"),
  );
  assert.equal(dataset.ok, true);
  assert.equal(
    dataset.fingerprint,
    "5b3df2f48bf3fb69252827e6137629162e8d058b16ac1282cd808662f52cb633",
  );

  const job = validateTrainingJob(
    await json("hercules-training/bootstrap/agent-router-job.json"),
  );
  assert.equal(job.ok, true);
  assert.equal(
    job.fingerprint,
    "0b0a986c8b4f30c60a6d56fdaf01ad97ec887d6921a4bc2e02c5218f931a8143",
  );

  const checkpoint = validateCheckpoint(
    await json("hercules-training/bootstrap/agent-router-checkpoint.json"),
  );
  assert.equal(checkpoint.ok, true);
  assert.equal(
    checkpoint.fingerprint,
    "de00769df2e015f4bcdaa0f79bef7c1ee0a990741bdba84621c2e01288a80cfb",
  );

  const suite = validateEvaluationSuite(
    await json("hercules-training/bootstrap/agent-router-eval-suite.json"),
  );
  assert.equal(suite.ok, true);
  assert.equal(
    suite.fingerprint,
    "8f75eb9a3effddc07110415232bdca3cf20ce6317cb2c3dcb7977fde08f44c41",
  );

  const result = validateEvaluationResult(
    await json("hercules-training/bootstrap/agent-router-eval-result.json"),
  );
  assert.equal(result.ok, true);
  assert.equal(
    result.fingerprint,
    "c270eac25c4483d0cac6541084b81442851a2e14ca4a86797db80d114f6ea76f",
  );
});

test("bootstrap checkpoint is exactly reproducible from Hercules training data", async () => {
  const train = await json("hercules-training/bootstrap/agent-router-train.json");
  const regenerated = trainAgentRouter(train, {alpha: 1});
  const bytes = JSON.stringify(regenerated, null, 2) + "\n";
  const checkpoint = await json("hercules-training/bootstrap/agent-router-checkpoint.json");
  const stored = await readFile("hercules-training/bootstrap/agent-router-model-v0.1.json", "utf8");

  assert.equal(bytes, stored);
  assert.equal(Buffer.byteLength(stored), checkpoint.bytes);
  assert.equal(sha256(stored), checkpoint.artifactSha256);
});

test("bootstrap evaluation evidence is reproducible and passes only its narrow gate", async () => {
  const model = await json("hercules-training/bootstrap/agent-router-model-v0.1.json");
  const examples = await json("hercules-training/bootstrap/agent-router-eval.json");
  const evaluation = evaluateAgentRouter(model, examples);

  assert.equal(evaluation.total, 16);
  assert.equal(evaluation.correct, 16);
  assert.equal(evaluation.accuracy, 1);

  const evidenceText = await readFile(
    "hercules-training/bootstrap/agent-router-evaluation-evidence.json",
    "utf8",
  );
  const recorded = await json("hercules-training/bootstrap/agent-router-eval-result.json");
  assert.equal(sha256(evidenceText), recorded.evidenceSha256);

  const scored = scoreEvaluation({
    suite: await json("hercules-training/bootstrap/agent-router-eval-suite.json"),
    result: recorded,
  });
  assert.equal(scored.ok, true);
});
