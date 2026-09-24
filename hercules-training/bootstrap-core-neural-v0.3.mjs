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
  evaluateNeuralLanguageModel,
  generateNeuralText,
  trainNeuralLanguageModel,
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
  const trainingRows = parseJsonl(trainingText);
  const evaluationRows = parseJsonl(evaluationText);
  const trainingTexts = trainingRows.map((row) => String(row.text ?? ""));
  const evaluationTexts = evaluationRows.map((row) => String(row.text ?? ""));

  const trainingManifest = validateDatasetManifest({
    version: "0.1",
    id: "core-neural-v03-train",
    description: "Owner-authored Hercules language corpus for Core neural next-token baseline v0.3.",
    sourceUri: "repo://hercules-training/bootstrap/language-foundation-train.jsonl",
    sourceType: "hercules-authored",
    contentSha256: sha256Bytes(Buffer.from(trainingText, "utf8")),
    recordCount: trainingRows.length,
    license: "Apache-2.0",
    rightsBasis: "Original Hercules project language material committed in the canonical repository.",
    trainingAllowed: true,
    createdAt,
    provenance: {
      origin: "Hercules canonical repository",
      acquiredBy: "Sauceapproved7",
      sourceCommit,
      notes: "Reuses the owner-authored v0.2 corpus for a neural candidate; no external corpus or weights.",
    },
  });
  if (!trainingManifest.ok) {
    throw new Error("neural training corpus failed provenance gate: " + trainingManifest.errors.join("; "));
  }

  const evaluationManifest = validateDatasetManifest({
    version: "0.1",
    id: "core-neural-v03-eval",
    description: "Held-out owner-authored Hercules language corpus for Core neural v0.3 evaluation.",
    sourceUri: "repo://hercules-training/bootstrap/language-foundation-eval.jsonl",
    sourceType: "hercules-authored",
    contentSha256: sha256Bytes(Buffer.from(evaluationText, "utf8")),
    recordCount: evaluationRows.length,
    license: "Apache-2.0",
    rightsBasis: "Original Hercules project evaluation material committed in the canonical repository.",
    trainingAllowed: true,
    createdAt,
    provenance: {
      origin: "Hercules canonical repository",
      acquiredBy: "Sauceapproved7",
      sourceCommit,
      notes: "Held out from neural training.",
    },
  });
  if (!evaluationManifest.ok) {
    throw new Error("neural evaluation corpus failed provenance gate: " + evaluationManifest.errors.join("; "));
  }

  const tokenizer = trainTokenizer(trainingTexts, {
    maxVocabulary: 256,
    minFrequency: 1,
  });
  const neuralModel = trainNeuralLanguageModel(tokenizer, trainingTexts, {
    embeddingDim: 12,
    seed: 37,
    epochs: 10,
    learningRate: 0.04,
    gradientClip: 5,
  });

  const payload = {tokenizer, neuralModel};
  const modelBytes = Buffer.from(stableStringify(payload) + "\n", "utf8");
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
      architecture: "token-embedding-softmax-next-token",
      embeddingDim: 12,
      epochs: 10,
      learningRate: 0.04,
      gradientClip: 5,
      vocabularyLimit: 256,
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
    parentCheckpointSha256: "b368c66417bd845d4aa1c65d18f381a6f694585862ba4bf6602179609eebca13",
    createdAt,
    sourceCommit,
  });
  if (!checkpoint.ok) {
    throw new Error("neural checkpoint invalid: " + checkpoint.errors.join("; "));
  }

  const raw = evaluateNeuralLanguageModel(tokenizer, neuralModel, evaluationTexts, trainingTexts);
  const coverage = tokenizerCoverage(tokenizer, evaluationTexts);
  const firstLoss = neuralModel.training.losses[0];
  const finalLoss = neuralModel.training.losses.at(-1);
  const lossReduction = firstLoss > 0 ? (firstLoss - finalLoss) / firstLoss : 0;

  const metrics = {
    "top1-accuracy": raw.top1Accuracy,
    "cross-entropy-ratio": raw.crossEntropyRatio,
    "token-coverage": coverage.coverage,
    "training-loss-reduction": lossReduction,
  };

  const suite = validateEvaluationSuite({
    version: "0.1",
    id: "core-neural-v03-gate",
    task: "general",
    description: "Held-out candidate gate for Hercules Core neural next-token baseline v0.3.",
    thresholds: [
      {metric: "top1-accuracy", op: "gte", value: 0.3},
      {metric: "cross-entropy-ratio", op: "lte", value: 0.95},
      {metric: "token-coverage", op: "gte", value: 0.8},
      {metric: "training-loss-reduction", op: "gte", value: 0.2},
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
      type: neuralModel.architecture,
      embeddingDim: neuralModel.embeddingDim,
      vocabularySize: neuralModel.vocabularySize,
      parameterCount:
        neuralModel.embeddings.length * neuralModel.embeddingDim
        + neuralModel.outputWeights.length * neuralModel.embeddingDim
        + neuralModel.outputBias.length,
    },
    training: neuralModel.training,
    language: raw,
    coverage,
    samples: [
      generateNeuralText(tokenizer, neuralModel, "Hercules ", {maxTokens: 24}),
      generateNeuralText(tokenizer, neuralModel, "The model plane ", {maxTokens: 24}),
    ],
  };

  const evaluation = validateEvaluationResult({
    version: "0.1",
    id: "core-neural-v03-result",
    suiteId: suite.suite.id,
    suiteFingerprint: suite.fingerprint,
    checkpointSha256: artifactSha256,
    metrics,
    evidenceSha256: sha256Bytes(Buffer.from(stableStringify(evidence), "utf8")),
    createdAt,
  });
  if (!evaluation.ok) {
    throw new Error("neural evaluation result invalid: " + evaluation.errors.join("; "));
  }

  const scored = scoreEvaluation({suite: suite.suite, result: evaluation.result});

  return {
    ok: scored.ok,
    candidateReady: scored.ok,
    tokenizer,
    neuralModel,
    modelBytes,
    trainingManifest: {manifest: trainingManifest.dataset, fingerprint: trainingManifest.fingerprint},
    evaluationManifest: {manifest: evaluationManifest.dataset, fingerprint: evaluationManifest.fingerprint},
    job: planned,
    checkpoint: {checkpoint: checkpoint.checkpoint, fingerprint: checkpoint.fingerprint},
    suite: {suite: suite.suite, fingerprint: suite.fingerprint},
    evaluation: {result: evaluation.result, fingerprint: evaluation.fingerprint, evidence, score: scored},
  };
}

async function main() {
  const sourceCommit = process.env.HERCULES_SOURCE_COMMIT ?? process.env.GITHUB_SHA;
  if (!sourceCommit || !/^[a-f0-9]{40}$/.test(sourceCommit)) {
    throw new Error("HERCULES_SOURCE_COMMIT or GITHUB_SHA must be a 40-character git SHA");
  }
  const createdAt = process.env.HERCULES_CREATED_AT ?? new Date().toISOString();
  const trainingPath = resolve(process.argv[2] ?? "hercules-training/bootstrap/language-foundation-train.jsonl");
  const evaluationPath = resolve(process.argv[3] ?? "hercules-training/bootstrap/language-foundation-eval.jsonl");
  const outDir = resolve(process.argv[4] ?? ".hercules-training/core-neural-v0.3");

  const [trainingText, evaluationText] = await Promise.all([
    readFile(trainingPath, "utf8"),
    readFile(evaluationPath, "utf8"),
  ]);

  const build = buildCoreNeuralCandidate({trainingText, evaluationText, sourceCommit, createdAt});
  if (!build.ok) throw new Error("Core neural v0.3 missed candidate gate");

  await mkdir(outDir, {recursive: true});
  await Promise.all([
    writeFile(join(outDir, "checkpoint.json"), build.modelBytes),
    writeFile(join(outDir, "training-evidence.json"), JSON.stringify({
      candidateReady: build.candidateReady,
      trainingManifest: build.trainingManifest,
      evaluationManifest: build.evaluationManifest,
      job: build.job,
      checkpoint: build.checkpoint,
      suite: build.suite,
      evaluation: build.evaluation,
    }, null, 2) + "\n"),
  ]);

  console.log(JSON.stringify({
    ok: true,
    candidateReady: build.candidateReady,
    modelId: "hercules-core",
    version: "0.3-neural-candidate",
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
