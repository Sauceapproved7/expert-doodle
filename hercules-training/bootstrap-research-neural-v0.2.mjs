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

export function buildResearchNeuralCandidate({
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
    throw new Error("Research neural corpus rows require text");
  }

  const trainingManifest = validateDatasetManifest({
    version: "0.1",
    id: "research-neural-v02-train",
    description: "Hercules-authored evidence-language corpus for Research neural candidate v0.2.",
    sourceUri: "repo://hercules-training/bootstrap/research-neural-v0.2-train.jsonl",
    sourceType: "hercules-authored",
    contentSha256: sha256Bytes(Buffer.from(trainingText, "utf8")),
    recordCount: trainingRows.length,
    license: "Apache-2.0",
    rightsBasis: "Original Hercules project research-training material committed in the canonical repository.",
    trainingAllowed: true,
    createdAt,
    provenance: {
      origin: "Hercules canonical repository",
      acquiredBy: "Sauceapproved7",
      sourceCommit,
      notes: "Owner-authored research and evidence patterns; no third-party text corpus, weights, tokenizer package, or ML SDK.",
    },
  });
  if (!trainingManifest.ok) {
    throw new Error("Research training corpus failed provenance gate: " + trainingManifest.errors.join("; "));
  }

  const evaluationManifest = validateDatasetManifest({
    version: "0.1",
    id: "research-neural-v02-eval",
    description: "Hercules-authored held-out evidence-language corpus for Research neural candidate v0.2.",
    sourceUri: "repo://hercules-training/bootstrap/research-neural-v0.2-eval.jsonl",
    sourceType: "hercules-authored",
    contentSha256: sha256Bytes(Buffer.from(evaluationText, "utf8")),
    recordCount: evaluationRows.length,
    license: "Apache-2.0",
    rightsBasis: "Original Hercules project held-out research evaluation material committed in the canonical repository.",
    trainingAllowed: true,
    createdAt,
    provenance: {
      origin: "Hercules canonical repository",
      acquiredBy: "Sauceapproved7",
      sourceCommit,
      notes: "Held-out owner-authored research patterns excluded from training.",
    },
  });
  if (!evaluationManifest.ok) {
    throw new Error("Research evaluation corpus failed provenance gate: " + evaluationManifest.errors.join("; "));
  }

  const tokenizer = trainTokenizer(trainingTexts, {
    maxVocabulary: 2048,
    minFrequency: 1,
  });

  const neuralModel = trainNeuralNextTokenModel(tokenizer, trainingTexts, {
    contextLength: 3,
    embeddingDim: 12,
    epochs: 32,
    learningRate: 0.065,
    seed: 47,
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

  const checkpointPayload = {tokenizer, neuralModel};
  const modelBytes = Buffer.from(
    stableStringify(checkpointPayload) + "\n",
    "utf8",
  );
  const artifactSha256 = sha256Bytes(modelBytes);

  const planned = createTrainingJob({
    id: "research-neural-v02-job",
    modelId: "hercules-research",
    task: "research",
    datasetManifests: [trainingManifest.dataset],
    seed: 47,
    codeCommit: sourceCommit,
    trainer: {
      engine: "hercules-native",
      version: "0.2",
      entrypoint: "hercules-training/native-neural-language-model.mjs",
    },
    hyperparameters: {
      architecture: "context-embedding-softmax",
      contextLength: 3,
      embeddingDim: 12,
      epochs: 32,
      learningRate: 0.065,
      tokenizer: "hercules-native-tokenizer/0.2",
      corpus: "hercules-research-evidence-v0.2",
    },
    createdAt,
  });

  const checkpoint = validateCheckpoint({
    version: "0.1",
    id: "research-neural-v02-checkpoint",
    modelId: "hercules-research",
    jobId: planned.job.id,
    jobFingerprint: planned.fingerprint,
    artifactSha256,
    bytes: modelBytes.length,
    format: "hercules-native-research-neural-v0.2",
    framework: "hercules-native-js",
    parentCheckpointSha256: null,
    createdAt,
    sourceCommit,
  });
  if (!checkpoint.ok) {
    throw new Error("Research neural checkpoint invalid: " + checkpoint.errors.join("; "));
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
    id: "research-neural-v02-gate",
    task: "research",
    description: "Held-out evidence-language gate for Hercules Research neural v0.2.",
    thresholds: [
      {metric: "top1-accuracy", op: "gte", value: 0.4},
      {metric: "content-top1-accuracy", op: "gte", value: 0.1},
      {metric: "unigram-improvement", op: "gte", value: 0.1},
      {metric: "backoff-cross-entropy-ratio", op: "lte", value: 1.4},
      {metric: "token-coverage", op: "gte", value: 0.85},
    ],
    sourceCommit,
  });
  if (!suite.ok) {
    throw new Error("Research neural evaluation suite invalid: " + suite.errors.join("; "));
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
      generateNeuralText(tokenizer, neuralModel, "Use the primary source ", {maxTokens: 28}),
      generateNeuralText(tokenizer, neuralModel, "Every factual claim ", {maxTokens: 28}),
      generateNeuralText(tokenizer, neuralModel, "State uncertainty ", {maxTokens: 28}),
    ],
  };

  const evaluation = validateEvaluationResult({
    version: "0.1",
    id: "research-neural-v02-result",
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
    throw new Error("Research neural evaluation result invalid: " + evaluation.errors.join("; "));
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
    process.argv[2] ?? "hercules-training/bootstrap/research-neural-v0.2-train.jsonl",
  );
  const evaluationPath = resolve(
    process.argv[3] ?? "hercules-training/bootstrap/research-neural-v0.2-eval.jsonl",
  );
  const outDir = resolve(
    process.argv[4] ?? ".hercules-training/research-neural-v0.2",
  );

  const [trainingText, evaluationText] = await Promise.all([
    readFile(trainingPath, "utf8"),
    readFile(evaluationPath, "utf8"),
  ]);

  const build = buildResearchNeuralCandidate({
    trainingText,
    evaluationText,
    sourceCommit,
    createdAt,
  });

  if (!build.ok) {
    throw new Error("Hercules Research neural v0.2 missed candidate gate");
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
    modelId: "hercules-research",
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
