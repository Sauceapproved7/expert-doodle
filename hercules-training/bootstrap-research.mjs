import {createHash} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {join, resolve} from "node:path";
import {HERCULES_MODEL_SLOTS} from "../hercules-models/catalog.mjs";
import {decideActivation} from "./activation.mjs";
import {stableStringify} from "./hash.mjs";
import {createTrainingJob} from "./planner.mjs";
import {
  classifyResearchStrategy,
  evaluateResearchStrategy,
  trainResearchStrategy,
} from "./native-research.mjs";
import {
  validateCheckpoint,
  validateDatasetManifest,
  validateEvaluationResult,
  validateEvaluationSuite,
} from "./schema.mjs";

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

export function buildNativeResearch({
  trainingText,
  evaluationText,
  sourceCommit,
  createdAt,
}) {
  const trainingRecords = parseJsonl(trainingText);
  const evaluationRecords = parseJsonl(evaluationText);

  const trainingManifest = validateDatasetManifest({
    version: "0.1",
    id: "research-strategy-train",
    description: "Hercules-authored examples for native research-strategy training.",
    sourceUri: "repo://hercules-training/bootstrap/research-strategy-train.jsonl",
    sourceType: "hercules-authored",
    contentSha256: sha256Bytes(Buffer.from(trainingText, "utf8")),
    recordCount: trainingRecords.length,
    license: "Apache-2.0",
    rightsBasis: "Original Hercules project training material committed in the canonical repository.",
    trainingAllowed: true,
    createdAt,
    provenance: {
      origin: "Hercules canonical repository",
      acquiredBy: "Sauceapproved7",
      sourceCommit,
      notes: "Original research-strategy examples; no third-party model weights or training dataset.",
    },
  });
  if (!trainingManifest.ok) {
    throw new Error("research training corpus failed provenance gate: " + trainingManifest.errors.join("; "));
  }

  const evaluationManifest = validateDatasetManifest({
    version: "0.1",
    id: "research-strategy-eval",
    description: "Hercules-authored held-out examples for native research-strategy evaluation.",
    sourceUri: "repo://hercules-training/bootstrap/research-strategy-eval.jsonl",
    sourceType: "hercules-authored",
    contentSha256: sha256Bytes(Buffer.from(evaluationText, "utf8")),
    recordCount: evaluationRecords.length,
    license: "Apache-2.0",
    rightsBasis: "Original Hercules project evaluation material committed in the canonical repository.",
    trainingAllowed: true,
    createdAt,
    provenance: {
      origin: "Hercules canonical repository",
      acquiredBy: "Sauceapproved7",
      sourceCommit,
      notes: "Held-out examples; not used to train the strategy classifier.",
    },
  });
  if (!evaluationManifest.ok) {
    throw new Error("research evaluation corpus failed provenance gate: " + evaluationManifest.errors.join("; "));
  }

  const planned = createTrainingJob({
    id: "research-bootstrap",
    modelId: "hercules-research",
    task: "research",
    datasetManifests: [trainingManifest.dataset],
    seed: 7,
    codeCommit: sourceCommit,
    trainer: {
      engine: "hercules-native",
      version: "0.1",
      entrypoint: "hercules-training/native-research.mjs",
    },
    hyperparameters: {
      algorithm: "multinomial-naive-bayes",
      alpha: 1,
      labels: ["primary", "current", "compare", "verify", "background"],
    },
    createdAt,
  });

  const model = trainResearchStrategy(trainingRecords, {alpha: 1});
  const modelBytes = Buffer.from(stableStringify(model) + "\n", "utf8");
  const artifactSha256 = sha256Bytes(modelBytes);

  const checkpointCheck = validateCheckpoint({
    version: "0.1",
    id: "research-bootstrap-checkpoint",
    modelId: "hercules-research",
    jobId: planned.job.id,
    jobFingerprint: planned.fingerprint,
    artifactSha256,
    bytes: modelBytes.length,
    format: "hercules-native-research-strategy",
    framework: "hercules-native-js",
    parentCheckpointSha256: null,
    createdAt,
    sourceCommit,
  });
  if (!checkpointCheck.ok) {
    throw new Error("research checkpoint invalid: " + checkpointCheck.errors.join("; "));
  }

  const detailed = evaluateResearchStrategy(model, evaluationRecords);
  const metrics = {
    accuracy: detailed.accuracy,
    "error-rate": detailed["error-rate"],
  };

  const suiteCheck = validateEvaluationSuite({
    version: "0.1",
    id: "research-bootstrap-gate",
    task: "research",
    description: "Held-out strategy-selection gate for Hercules Research v0.1.",
    thresholds: [
      {metric: "accuracy", op: "gte", value: 0.9},
      {metric: "error-rate", op: "lte", value: 0.1},
    ],
    sourceCommit,
  });
  if (!suiteCheck.ok) {
    throw new Error("research evaluation suite invalid: " + suiteCheck.errors.join("; "));
  }

  const evidence = {
    dataset: {
      id: evaluationManifest.dataset.id,
      contentSha256: evaluationManifest.dataset.contentSha256,
      manifestFingerprint: evaluationManifest.fingerprint,
    },
    rows: detailed.rows,
  };

  const resultCheck = validateEvaluationResult({
    version: "0.1",
    id: "research-bootstrap-eval",
    suiteId: suiteCheck.suite.id,
    suiteFingerprint: suiteCheck.fingerprint,
    checkpointSha256: artifactSha256,
    metrics,
    evidenceSha256: sha256Bytes(Buffer.from(stableStringify(evidence), "utf8")),
    createdAt,
  });
  if (!resultCheck.ok) {
    throw new Error("research evaluation result invalid: " + resultCheck.errors.join("; "));
  }

  const decision = decideActivation({
    model: canonicalModel("hercules-research"),
    checkpoint: checkpointCheck.checkpoint,
    evaluations: [resultCheck.result],
    requiredSuites: [suiteCheck.suite],
    runtime: {kind: "embedded", endpoint: null},
  });

  return {
    ok: decision.ok,
    model,
    modelBytes,
    trainingManifest: {manifest: trainingManifest.dataset, fingerprint: trainingManifest.fingerprint},
    evaluationManifest: {manifest: evaluationManifest.dataset, fingerprint: evaluationManifest.fingerprint},
    job: planned,
    checkpoint: {checkpoint: checkpointCheck.checkpoint, fingerprint: checkpointCheck.fingerprint},
    suite: {suite: suiteCheck.suite, fingerprint: suiteCheck.fingerprint},
    evaluation: {result: resultCheck.result, fingerprint: resultCheck.fingerprint, evidence},
    decision,
  };
}

async function main() {
  const sourceCommit = process.env.HERCULES_SOURCE_COMMIT ?? process.env.GITHUB_SHA;
  if (!sourceCommit || !/^[a-f0-9]{40}$/.test(sourceCommit)) {
    throw new Error("HERCULES_SOURCE_COMMIT or GITHUB_SHA must be a 40-character git SHA");
  }
  const createdAt = process.env.HERCULES_CREATED_AT ?? new Date().toISOString();
  const trainingPath = resolve(process.argv[2] ?? "hercules-training/bootstrap/research-strategy-train.jsonl");
  const evaluationPath = resolve(process.argv[3] ?? "hercules-training/bootstrap/research-strategy-eval.jsonl");
  const outDir = resolve(process.argv[4] ?? ".hercules-training/bootstrap-research");

  const [trainingText, evaluationText] = await Promise.all([
    readFile(trainingPath, "utf8"),
    readFile(evaluationPath, "utf8"),
  ]);

  const build = buildNativeResearch({trainingText, evaluationText, sourceCommit, createdAt});
  if (!build.ok) {
    throw new Error("native Research failed activation gate: " + build.decision.reasons.join("; "));
  }

  await mkdir(outDir, {recursive: true});
  await Promise.all([
    writeFile(join(outDir, "model.json"), build.modelBytes),
    writeFile(join(outDir, "training-evidence.json"), JSON.stringify({
      trainingManifest: build.trainingManifest,
      evaluationManifest: build.evaluationManifest,
      job: build.job,
      checkpoint: build.checkpoint,
      suite: build.suite,
      evaluation: build.evaluation,
      decision: build.decision,
    }, null, 2) + "\n"),
  ]);

  console.log(JSON.stringify({
    ok: true,
    modelId: "hercules-research",
    checkpointSha256: build.checkpoint.checkpoint.artifactSha256,
    accuracy: build.evaluation.result.metrics.accuracy,
    errorRate: build.evaluation.result.metrics["error-rate"],
    sample: classifyResearchStrategy(build.model, "verify this claim against the official filing").strategy,
    output: outDir,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
