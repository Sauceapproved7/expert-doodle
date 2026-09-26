import {createHash} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {join, resolve} from "node:path";
import {stableStringify} from "./hash.mjs";
import {createTrainingJob} from "./planner.mjs";
import {
  validateCheckpoint,
  validateDatasetManifest,
  validateEvaluationResult,
  validateEvaluationSuite,
} from "./schema.mjs";
import {scoreEvaluation} from "./evaluation.mjs";
import {
  evaluateVisionPixelClassifier,
  trainVisionPixelClassifier,
} from "./native-vision-pixel.mjs";

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseJsonl(text) {
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

export function buildVisionPixelCandidate({
  trainingText,
  evaluationText,
  sourceCommit,
  createdAt,
}) {
  if (!/^[a-f0-9]{40}$/.test(sourceCommit ?? "")) {
    throw new TypeError("sourceCommit must be a 40-character git SHA");
  }
  if (!createdAt) throw new TypeError("createdAt is required");

  const trainingSamples = parseJsonl(trainingText);
  const evaluationSamples = parseJsonl(evaluationText);

  const trainingManifest = validateDatasetManifest({
    version: "0.1",
    id: "vision-pixel-v02-train",
    description: "Hercules-authored noisy raster patterns for native pixel vision training.",
    sourceUri: "repo://hercules-training/bootstrap/vision-pixel-v0.2-train.jsonl",
    sourceType: "hercules-authored",
    contentSha256: sha256Bytes(Buffer.from(trainingText, "utf8")),
    recordCount: trainingSamples.length,
    license: "Apache-2.0",
    rightsBasis: "Original Hercules project raster training material committed in the canonical repository.",
    trainingAllowed: true,
    createdAt,
    provenance: {
      origin: "Hercules canonical repository",
      acquiredBy: "Sauceapproved7",
      sourceCommit,
      notes: "Owner-authored procedural raster patterns; no external image dataset, model weights, or vision SDK.",
    },
  });
  if (!trainingManifest.ok) {
    throw new Error("Vision training corpus failed provenance gate: " + trainingManifest.errors.join("; "));
  }

  const evaluationManifest = validateDatasetManifest({
    version: "0.1",
    id: "vision-pixel-v02-eval",
    description: "Hercules-authored held-out shifted and noisy raster patterns for native pixel vision evaluation.",
    sourceUri: "repo://hercules-training/bootstrap/vision-pixel-v0.2-eval.jsonl",
    sourceType: "hercules-authored",
    contentSha256: sha256Bytes(Buffer.from(evaluationText, "utf8")),
    recordCount: evaluationSamples.length,
    license: "Apache-2.0",
    rightsBasis: "Original Hercules project held-out raster evaluation material committed in the canonical repository.",
    trainingAllowed: true,
    createdAt,
    provenance: {
      origin: "Hercules canonical repository",
      acquiredBy: "Sauceapproved7",
      sourceCommit,
      notes: "Held-out procedural raster variants excluded from training.",
    },
  });
  if (!evaluationManifest.ok) {
    throw new Error("Vision evaluation corpus failed provenance gate: " + evaluationManifest.errors.join("; "));
  }

  const model = trainVisionPixelClassifier(trainingSamples, {
    hiddenDim: 12,
    epochs: 48,
    learningRate: 0.04,
    seed: 59,
    initScale: 0.08,
  });

  const modelBytes = Buffer.from(stableStringify(model) + "\n", "utf8");
  const artifactSha256 = sha256Bytes(modelBytes);

  const planned = createTrainingJob({
    id: "vision-pixel-v02-job",
    modelId: "hercules-vision",
    task: "vision",
    datasetManifests: [trainingManifest.dataset],
    seed: 59,
    codeCommit: sourceCommit,
    trainer: {
      engine: "hercules-native",
      version: "0.2",
      entrypoint: "hercules-training/native-vision-pixel.mjs",
    },
    hyperparameters: {
      architecture: "pixel-mlp-softmax",
      width: model.width,
      height: model.height,
      hiddenDim: model.hiddenDim,
      epochs: model.epochs,
      learningRate: model.learningRate,
      classes: model.labels,
    },
    createdAt,
  });

  const checkpoint = validateCheckpoint({
    version: "0.1",
    id: "vision-pixel-v02-checkpoint",
    modelId: "hercules-vision",
    jobId: planned.job.id,
    jobFingerprint: planned.fingerprint,
    artifactSha256,
    bytes: modelBytes.length,
    format: "hercules-native-vision-pixel-v0.2",
    framework: "hercules-native-js",
    parentCheckpointSha256: null,
    createdAt,
    sourceCommit,
  });
  if (!checkpoint.ok) {
    throw new Error("Vision pixel checkpoint invalid: " + checkpoint.errors.join("; "));
  }

  const detailed = evaluateVisionPixelClassifier(model, evaluationSamples);
  const metrics = {
    accuracy: detailed.accuracy,
    "min-class-recall": detailed.minClassRecall,
    "baseline-improvement": detailed.baselineImprovement,
  };

  const suite = validateEvaluationSuite({
    version: "0.1",
    id: "vision-pixel-v02-gate",
    task: "vision",
    description: "Held-out noisy raster gate for Hercules Vision Pixel v0.2.",
    thresholds: [
      {metric: "accuracy", op: "gte", value: 0.9},
      {metric: "min-class-recall", op: "gte", value: 0.8},
      {metric: "baseline-improvement", op: "gte", value: 0.65},
    ],
    sourceCommit,
  });
  if (!suite.ok) {
    throw new Error("Vision pixel evaluation suite invalid: " + suite.errors.join("; "));
  }

  const evidence = {
    evaluationDataset: {
      id: evaluationManifest.dataset.id,
      contentSha256: evaluationManifest.dataset.contentSha256,
      manifestFingerprint: evaluationManifest.fingerprint,
    },
    architecture: {
      format: model.format,
      algorithm: model.algorithm,
      width: model.width,
      height: model.height,
      hiddenDim: model.hiddenDim,
      labels: model.labels,
      trainingSamples: model.trainingSamples,
      epochs: model.epochs,
    },
    perClassRecall: detailed.perClassRecall,
    rows: detailed.rows,
  };

  const evaluation = validateEvaluationResult({
    version: "0.1",
    id: "vision-pixel-v02-result",
    suiteId: suite.suite.id,
    suiteFingerprint: suite.fingerprint,
    checkpointSha256: artifactSha256,
    metrics,
    evidenceSha256: sha256Bytes(
      Buffer.from(stableStringify(evidence), "utf8"),
    ),
    createdAt,
  });
  if (!evaluation.ok) {
    throw new Error("Vision pixel evaluation result invalid: " + evaluation.errors.join("; "));
  }

  const scored = scoreEvaluation({
    suite: suite.suite,
    result: evaluation.result,
  });

  return {
    ok: scored.ok,
    candidateReady: scored.ok,
    model,
    modelBytes,
    trainingManifest: {
      manifest: trainingManifest.dataset,
      fingerprint: trainingManifest.fingerprint,
    },
    evaluationManifest: {
      manifest: evaluationManifest.dataset,
      fingerprint: evaluationManifest.fingerprint,
    },
    job: planned,
    checkpoint: {
      checkpoint: checkpoint.checkpoint,
      fingerprint: checkpoint.fingerprint,
    },
    suite: {
      suite: suite.suite,
      fingerprint: suite.fingerprint,
    },
    evaluation: {
      result: evaluation.result,
      fingerprint: evaluation.fingerprint,
      evidence,
      score: scored,
    },
  };
}

async function main() {
  const sourceCommit = process.env.HERCULES_SOURCE_COMMIT ?? process.env.GITHUB_SHA;
  const createdAt = process.env.HERCULES_CREATED_AT ?? new Date().toISOString();
  const trainingPath = resolve(
    process.argv[2] ?? "hercules-training/bootstrap/vision-pixel-v0.2-train.jsonl",
  );
  const evaluationPath = resolve(
    process.argv[3] ?? "hercules-training/bootstrap/vision-pixel-v0.2-eval.jsonl",
  );
  const outDir = resolve(
    process.argv[4] ?? ".hercules-training/vision-pixel-v0.2",
  );

  const [trainingText, evaluationText] = await Promise.all([
    readFile(trainingPath, "utf8"),
    readFile(evaluationPath, "utf8"),
  ]);

  const build = buildVisionPixelCandidate({
    trainingText,
    evaluationText,
    sourceCommit,
    createdAt,
  });

  if (!build.ok) {
    throw new Error("Hercules Vision Pixel v0.2 missed candidate gate");
  }

  await mkdir(outDir, {recursive: true});
  await Promise.all([
    writeFile(join(outDir, "checkpoint.json"), build.modelBytes),
    writeFile(
      join(outDir, "training-evidence.json"),
      JSON.stringify({
        candidateReady: build.candidateReady,
        trainingManifest: build.trainingManifest,
        evaluationManifest: build.evaluationManifest,
        job: build.job,
        checkpoint: build.checkpoint,
        suite: build.suite,
        evaluation: build.evaluation,
      }, null, 2) + "\n",
    ),
  ]);

  console.log(JSON.stringify({
    ok: true,
    candidateReady: build.candidateReady,
    modelId: "hercules-vision",
    version: "0.2-candidate",
    checkpointSha256: build.checkpoint.checkpoint.artifactSha256,
    checkpointBytes: build.checkpoint.checkpoint.bytes,
    metrics: build.evaluation.result.metrics,
    output: outDir,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
