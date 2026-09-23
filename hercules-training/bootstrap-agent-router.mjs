import {createHash} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {join, resolve} from "node:path";
import {HERCULES_MODEL_SLOTS} from "../hercules-models/catalog.mjs";
import {trainAgentRouter, evaluateAgentRouter} from "./native-agent-router.mjs";
import {createTrainingJob} from "./planner.mjs";
import {
  validateCheckpoint,
  validateDatasetManifest,
  validateEvaluationResult,
  validateEvaluationSuite,
} from "./schema.mjs";
import {decideActivation} from "./activation.mjs";
import {stableStringify} from "./hash.mjs";

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseJsonl(text) {
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function canonicalModel(id) {
  const model = HERCULES_MODEL_SLOTS.find((item) => item.id === id);
  if (!model) throw new Error("unknown canonical model: " + id);
  return structuredClone(model);
}

export function buildNativeAgentRouter({
  trainText,
  evalText,
  sourceCommit,
  createdAt,
}) {
  const trainRecords = parseJsonl(trainText);
  const evalRecords = parseJsonl(evalText);

  const trainManifestCheck = validateDatasetManifest({
    version: "0.1",
    id: "agent-routing-train",
    description: "Hercules-authored bootstrap corpus for native agent intent routing.",
    sourceUri: "repo://hercules-training/bootstrap/agent-routing-train.jsonl",
    sourceType: "hercules-authored",
    contentSha256: sha256Bytes(Buffer.from(trainText, "utf8")),
    recordCount: trainRecords.length,
    license: "Apache-2.0",
    rightsBasis: "Original Hercules project training material committed in the canonical repository.",
    trainingAllowed: true,
    createdAt,
    provenance: {
      origin: "Hercules canonical repository",
      acquiredBy: "Sauceapproved7",
      sourceCommit,
      notes: "Original bootstrap examples; no third-party model weights or dataset dependency.",
    },
  });
  if (!trainManifestCheck.ok) {
    throw new Error("training dataset failed provenance gate: " + trainManifestCheck.errors.join("; "));
  }

  const evalManifestCheck = validateDatasetManifest({
    version: "0.1",
    id: "agent-routing-eval",
    description: "Hercules-authored held-out evaluation corpus for native agent intent routing.",
    sourceUri: "repo://hercules-training/bootstrap/agent-routing-eval.jsonl",
    sourceType: "hercules-authored",
    contentSha256: sha256Bytes(Buffer.from(evalText, "utf8")),
    recordCount: evalRecords.length,
    license: "Apache-2.0",
    rightsBasis: "Original Hercules project evaluation material committed in the canonical repository.",
    trainingAllowed: true,
    createdAt,
    provenance: {
      origin: "Hercules canonical repository",
      acquiredBy: "Sauceapproved7",
      sourceCommit,
      notes: "Held out from training and used only for bootstrap evaluation.",
    },
  });
  if (!evalManifestCheck.ok) {
    throw new Error("evaluation dataset failed provenance gate: " + evalManifestCheck.errors.join("; "));
  }

  const planned = createTrainingJob({
    id: "agent-router-bootstrap",
    modelId: "hercules-agent",
    task: "agent",
    datasetManifests: [trainManifestCheck.dataset],
    seed: 7,
    codeCommit: sourceCommit,
    trainer: {
      engine: "hercules-native",
      version: "0.1",
      entrypoint: "hercules-training/native-agent-router.mjs",
    },
    hyperparameters: {
      algorithm: "multinomial-naive-bayes",
      alpha: 1,
    },
    createdAt,
  });

  const model = trainAgentRouter(trainRecords, {alpha: 1});
  const modelBytes = Buffer.from(stableStringify(model) + "\n", "utf8");
  const artifactSha256 = sha256Bytes(modelBytes);

  const checkpointCheck = validateCheckpoint({
    version: "0.1",
    id: "agent-router-bootstrap-checkpoint",
    modelId: "hercules-agent",
    jobId: planned.job.id,
    jobFingerprint: planned.fingerprint,
    artifactSha256,
    bytes: modelBytes.length,
    format: "hercules-agent-router-naive-bayes",
    framework: "hercules-native-js",
    parentCheckpointSha256: null,
    createdAt,
    sourceCommit,
  });
  if (!checkpointCheck.ok) {
    throw new Error("checkpoint metadata invalid: " + checkpointCheck.errors.join("; "));
  }

  const detailed = evaluateAgentRouter(model, evalRecords);
  const metrics = {
    accuracy: detailed.accuracy,
    "error-rate": 1 - detailed.accuracy,
  };

  const suiteCheck = validateEvaluationSuite({
    version: "0.1",
    id: "agent-routing-bootstrap-gate",
    task: "agent",
    description: "Bootstrap gate for the first Hercules-native agent router.",
    thresholds: [
      {metric: "accuracy", op: "gte", value: 0.8},
      {metric: "error-rate", op: "lte", value: 0.2},
    ],
    sourceCommit,
  });
  if (!suiteCheck.ok) {
    throw new Error("evaluation suite invalid: " + suiteCheck.errors.join("; "));
  }

  const evaluationEvidence = {
    dataset: {
      id: evalManifestCheck.dataset.id,
      contentSha256: evalManifestCheck.dataset.contentSha256,
      manifestFingerprint: evalManifestCheck.fingerprint,
    },
    predictions: detailed.rows,
  };

  const resultCheck = validateEvaluationResult({
    version: "0.1",
    id: "agent-routing-bootstrap-eval",
    suiteId: suiteCheck.suite.id,
    suiteFingerprint: suiteCheck.fingerprint,
    checkpointSha256: artifactSha256,
    metrics,
    evidenceSha256: sha256Bytes(Buffer.from(stableStringify(evaluationEvidence), "utf8")),
    createdAt,
  });
  if (!resultCheck.ok) {
    throw new Error("evaluation result invalid: " + resultCheck.errors.join("; "));
  }

  const decision = decideActivation({
    model: canonicalModel("hercules-agent"),
    checkpoint: checkpointCheck.checkpoint,
    evaluations: [resultCheck.result],
    requiredSuites: [suiteCheck.suite],
    runtime: {kind: "embedded", endpoint: null},
  });

  return {
    ok: decision.ok,
    model,
    modelBytes,
    trainManifest: {
      manifest: trainManifestCheck.dataset,
      fingerprint: trainManifestCheck.fingerprint,
    },
    evalManifest: {
      manifest: evalManifestCheck.dataset,
      fingerprint: evalManifestCheck.fingerprint,
    },
    job: planned,
    checkpoint: {
      checkpoint: checkpointCheck.checkpoint,
      fingerprint: checkpointCheck.fingerprint,
    },
    suite: {
      suite: suiteCheck.suite,
      fingerprint: suiteCheck.fingerprint,
    },
    evaluation: {
      result: resultCheck.result,
      fingerprint: resultCheck.fingerprint,
      evidence: evaluationEvidence,
    },
    decision,
  };
}

async function main() {
  const sourceCommit = process.env.HERCULES_SOURCE_COMMIT ?? process.env.GITHUB_SHA;
  if (!sourceCommit || !/^[a-f0-9]{40}$/.test(sourceCommit)) {
    throw new Error("HERCULES_SOURCE_COMMIT or GITHUB_SHA must be a 40-character git SHA");
  }

  const createdAt = process.env.HERCULES_CREATED_AT ?? new Date().toISOString();
  const trainPath = resolve(process.argv[2] ?? "hercules-training/bootstrap/agent-routing-train.jsonl");
  const evalPath = resolve(process.argv[3] ?? "hercules-training/bootstrap/agent-routing-eval.jsonl");
  const outDir = resolve(process.argv[4] ?? ".hercules-training/bootstrap-agent-router");

  const [trainText, evalText] = await Promise.all([
    readFile(trainPath, "utf8"),
    readFile(evalPath, "utf8"),
  ]);

  const build = buildNativeAgentRouter({
    trainText,
    evalText,
    sourceCommit,
    createdAt,
  });

  if (!build.ok) {
    throw new Error("native agent router failed activation gate: " + build.decision.reasons.join("; "));
  }

  await mkdir(outDir, {recursive: true});
  await Promise.all([
    writeFile(join(outDir, "model.json"), build.modelBytes),
    writeFile(join(outDir, "training-evidence.json"), JSON.stringify({
      trainManifest: build.trainManifest,
      evalManifest: build.evalManifest,
      job: build.job,
      checkpoint: build.checkpoint,
      suite: build.suite,
      evaluation: build.evaluation,
      decision: build.decision,
    }, null, 2) + "\n"),
  ]);

  console.log(JSON.stringify({
    ok: true,
    modelId: "hercules-agent",
    checkpointSha256: build.checkpoint.checkpoint.artifactSha256,
    accuracy: build.evaluation.result.metrics.accuracy,
    errorRate: build.evaluation.result.metrics["error-rate"],
    output: outDir,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
