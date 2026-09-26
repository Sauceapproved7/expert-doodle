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
  trainTokenizer,
  tokenizerCoverage,
} from "./native-tokenizer.mjs";
import {
  evaluateNextTokenModel,
  trainNextTokenModel,
} from "./native-language-model.mjs";
import {
  evaluateNeuralNextTokenModel,
  generateNeuralText,
  trainNeuralNextTokenModel,
} from "./native-neural-language-model.mjs";

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseJsonl(text) {
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

export function buildCoreNeuralCandidate({
  trainingText,
  evaluationText,
  sourceCommit,
  createdAt,
}) {
  if (!/^[a-f0-9]{40}$/.test(sourceCommit ?? "")) {
    throw new TypeError("sourceCommit must be a 40-character git SHA");
  }
  if (!createdAt) throw new TypeError("createdAt is required");

  const trainingRows = parseJsonl(trainingText);
  const evaluationRows = parseJsonl(evaluationText);
  const trainingTexts = trainingRows.map((row) => String(row.text ?? ""));
  const evaluationTexts = evaluationRows.map((row) => String(row.text ?? ""));

  if (trainingTexts.some((text) => !text) || evaluationTexts.some((text) => !text)) {
    throw new Error("neural language corpus rows require text");
  }

  const trainingManifest = validateDatasetManifest({
    version: "0.1",
    id: "core-neural-v03-train",
    description: "Hercules-authored corpus for Core neural next-token candidate v0.3.",
    sourceUri: "repo://hercules-training/bootstrap/language-foundation-train.jsonl",
    sourceType: "hercules-authored",
    contentSha256: sha256Bytes(Buffer.from(trainingText, "utf8")),
    recordCount: trainingRows.length,
    license: "Apache-2.0",
    rightsBasis: "Original Hercules project language-training material committed in the canonical repository.",
    trainingAllowed: true,
    createdAt,
    provenance: {
      origin: "Hercules canonical repository",
      acquiredBy: "Sauceapproved7",
      sourceCommit,
      notes: "Owner-authored language corpus; no third-party corpus, tokenizer, model weights, or ML SDK.",
    },
  });
  if (!trainingManifest.ok) {
    throw new Error("neural training corpus failed provenance gate: " + trainingManifest.errors.join("; "));
  }

  const evaluationManifest = validateDatasetManifest({
    version: "0.1",
    id: "core-neural-v03-eval",
    description: "Hercules-authored held-out corpus for Core neural next-token candidate v0.3.",
    sourceUri: "repo://hercules-training/bootstrap/language-foundation-eval.jsonl",
    sourceType: "hercules-authored",
    contentSha256: sha256Bytes(Buffer.from(evaluationText, "utf8")),
    recordCount: evaluationRows.length,
    license: "Apache-2.0",
    rightsBasis: "Original Hercules project held-out evaluation material committed in the canonical repository.",
    trainingAllowed: true,
    createdAt,
    provenance: {
      origin: "Hercules canonical repository",
      acquiredBy: "Sauceapproved7",
      sourceCommit,
      notes: "Held out from neural training and reused only for version-to-version language evaluation.",
    },
  });
  if (!evaluationManifest.ok) {
    throw new Error("neural evaluation corpus failed provenance gate: " + evaluationManifest.errors.join("; "));
  }

  const tokenizer = trainTokenizer(trainingTexts, {
    maxVocabulary: 2048,
    minFrequency: 1,
  });

  const neuralModel = trainNeuralNextTokenModel(tokenizer, trainingTexts, {
    contextLength: 2,
    embeddingDim: 12,
    epochs: 36,
    learningRate: 0.08,
    seed: 37,
    initScale: 0.04,
  });

  const backoffModel = trainNextTokenModel(tokenizer, trainingTexts);
  const neuralMetrics = evaluateNeuralNextTokenModel(
    tokenizer,
    neuralModel,
    evaluationTexts,
  );
  const backoffMetrics = evaluateNextTokenModel(
    tokenizer,
    backoffModel,
    evaluationTexts,
  );
  const coverage = tokenizerCoverage(tokenizer, evaluationTexts);

  const checkpointPayload = {
    tokenizer,
    neuralModel,
  };
  const modelBytes = Buffer.from(
    stableStringify(checkpointPayload) + "\n",
    "utf8",
  );
  const artifactSha256 = sha256Bytes(modelBytes);

  const planned = createTrainingJob({
    id: "core-neural-v03-job",
    modelId: "hercules-core",
    task: "general",
    datasetManifests: [trainingManifest.dataset],
    seed: 37,
    codeCommit: sourceCommit,
    trainer: {
      engine: "hercules-native",
      version: "0.3",
      entrypoint: "hercules-training/native-neural-language-model.mjs",
    },
    hyperparameters: {
      architecture: "context-embedding-softmax",
      contextLength: 2,
      embeddingDim: 12,
      epochs: 36,
      learningRate: 0.08,
      tokenizer: "hercules-native-tokenizer/0.2",
    },
    createdAt,
  });

  const checkpoint = validateCheckpoint({
    version: "0.1",
    id: "core-neural-v03-checkpoint",
    modelId: "hercules-core",
    jobId: planned.job.id,
    jobFingerprint: planned.fingerprint,
    artifactSha256,
    bytes: modelBytes.length,
    format: "hercules-native-neural-language-v0.3",
    framework: "hercules-native-js",
    parentCheckpointSha256: null,
    createdAt,
    sourceCommit,
  });
  if (!checkpoint.ok) {
    throw new Error("neural checkpoint invalid: " + checkpoint.errors.join("; "));
  }

  const unigramImprovement =
    1 - neuralMetrics.crossEntropy / neuralMetrics.unigramCrossEntropy;
  const backoffRatio =
    neuralMetrics.crossEntropy / Math.max(backoffMetrics.crossEntropy, 1e-12);

  const metrics = {
    "top1-accuracy": neuralMetrics.top1Accuracy,
    "content-top1-accuracy": neuralMetrics.nonWhitespaceTop1Accuracy,
    "unigram-improvement": unigramImprovement,
    "backoff-cross-entropy-ratio": backoffRatio,
    "token-coverage": coverage.coverage,
  };

  const suite = validateEvaluationSuite({
    version: "0.1",
    id: "core-neural-v03-gate",
    task: "general",
    description: "Held-out candidate gate for Hercules Core neural language v0.3.",
    thresholds: [
      {metric: "top1-accuracy", op: "gte", value: 0.3},
      {metric: "content-top1-accuracy", op: "gte", value: 0.08},
      {metric: "unigram-improvement", op: "gte", value: 0.05},
      {metric: "backoff-cross-entropy-ratio", op: "lte", value: 1.35},
      {metric: "token-coverage", op: "gte", value: 0.8},
    ],
    sourceCommit,
  });
  if (!suite.ok) {
    throw new Error("neural evaluation suite invalid: " + suite.errors.join("; "));
  }

  const evidence = {
    evaluationDataset: {
      id: evaluationManifest.dataset.id,
      contentSha256: evaluationManifest.dataset.contentSha256,
      manifestFingerprint: evaluationManifest.fingerprint,
    },
    architecture: {
      format: neuralModel.format,
      algorithm: neuralModel.algorithm,
      contextLength: neuralModel.contextLength,
      embeddingDim: neuralModel.embeddingDim,
      vocabularySize: neuralModel.vocabularySize,
      trainingExamples: neuralModel.trainingExamples,
      epochs: neuralModel.epochs,
    },
    coverage,
    neuralMetrics,
    backoffMetrics,
    samples: [
      generateNeuralText(tokenizer, neuralModel, "Hercules ", {maxTokens: 24}),
      generateNeuralText(tokenizer, neuralModel, "The model plane ", {maxTokens: 24}),
      generateNeuralText(tokenizer, neuralModel, "A native Hercules ", {maxTokens: 24}),
    ],
  };

  const evaluation = validateEvaluationResult({
    version: "0.1",
    id: "core-neural-v03-result",
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
    throw new Error("neural evaluation result invalid: " + evaluation.errors.join("; "));
  }

  const scored = scoreEvaluation({
    suite: suite.suite,
    result: evaluation.result,
  });

  return {
    ok: scored.ok,
    candidateReady: scored.ok,
    tokenizer,
    neuralModel,
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
    process.argv[2] ??
      "hercules-training/bootstrap/language-foundation-train.jsonl",
  );
  const evaluationPath = resolve(
    process.argv[3] ??
      "hercules-training/bootstrap/language-foundation-eval.jsonl",
  );
  const outDir = resolve(
    process.argv[4] ?? ".hercules-training/core-neural-v0.3",
  );

  const [trainingText, evaluationText] = await Promise.all([
    readFile(trainingPath, "utf8"),
    readFile(evaluationPath, "utf8"),
  ]);

  const build = buildCoreNeuralCandidate({
    trainingText,
    evaluationText,
    sourceCommit,
    createdAt,
  });

  if (!build.ok) {
    throw new Error("Hercules Core neural v0.3 missed candidate gate");
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
    modelId: "hercules-core",
    version: "0.3-candidate",
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
