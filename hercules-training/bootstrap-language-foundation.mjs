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
  generateText,
  trainNextTokenModel,
} from "./native-language-model.mjs";

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseJsonl(text) {
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

export function buildLanguageFoundation({
  trainingText,
  evaluationText,
  sourceCommit,
  createdAt,
}) {
  const trainingRows = parseJsonl(trainingText);
  const evaluationRows = parseJsonl(evaluationText);
  const trainingTexts = trainingRows.map((row) => String(row.text ?? ""));
  const evaluationTexts = evaluationRows.map((row) => String(row.text ?? ""));

  if (trainingTexts.some((text) => !text) || evaluationTexts.some((text) => !text)) {
    throw new Error("language corpus rows require text");
  }

  const trainingManifest = validateDatasetManifest({
    version: "0.1",
    id: "language-foundation-train",
    description: "Hercules-authored corpus for native tokenizer and next-token language foundation training.",
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
      notes: "Owner-authored project language; no third-party language corpus or model weights.",
    },
  });
  if (!trainingManifest.ok) {
    throw new Error("language training corpus failed provenance gate: " + trainingManifest.errors.join("; "));
  }

  const evaluationManifest = validateDatasetManifest({
    version: "0.1",
    id: "language-foundation-eval",
    description: "Hercules-authored held-out corpus for native next-token language evaluation.",
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
      notes: "Held-out owner-authored language examples; excluded from training.",
    },
  });
  if (!evaluationManifest.ok) {
    throw new Error("language evaluation corpus failed provenance gate: " + evaluationManifest.errors.join("; "));
  }

  const tokenizer = trainTokenizer(trainingTexts, {
    maxVocabulary: 2048,
    minFrequency: 1,
  });
  const languageModel = trainNextTokenModel(tokenizer, trainingTexts);
  const checkpointPayload = {tokenizer, languageModel};
  const modelBytes = Buffer.from(stableStringify(checkpointPayload) + "\n", "utf8");
  const artifactSha256 = sha256Bytes(modelBytes);

  const planned = createTrainingJob({
    id: "core-language-v02-job",
    modelId: "hercules-core",
    task: "general",
    datasetManifests: [trainingManifest.dataset],
    seed: 23,
    codeCommit: sourceCommit,
    trainer: {
      engine: "hercules-native",
      version: "0.2",
      entrypoint: "hercules-training/native-language-model.mjs",
    },
    hyperparameters: {
      tokenizer: "word-punctuation-whitespace",
      vocabularyLimit: 2048,
      languageObjective: "trigram-bigram-unigram-backoff",
    },
    createdAt,
  });

  const checkpoint = validateCheckpoint({
    version: "0.1",
    id: "core-language-v02-checkpoint",
    modelId: "hercules-core",
    jobId: planned.job.id,
    jobFingerprint: planned.fingerprint,
    artifactSha256,
    bytes: modelBytes.length,
    format: "hercules-native-language-foundation-v0.2",
    framework: "hercules-native-js",
    parentCheckpointSha256: null,
    createdAt,
    sourceCommit,
  });
  if (!checkpoint.ok) {
    throw new Error("language checkpoint invalid: " + checkpoint.errors.join("; "));
  }

  const metricsRaw = evaluateNextTokenModel(tokenizer, languageModel, evaluationTexts);
  const coverage = tokenizerCoverage(tokenizer, evaluationTexts);
  const metrics = {
    "top1-accuracy": metricsRaw.top1Accuracy,
    "cross-entropy-ratio": metricsRaw.crossEntropyRatio,
    "token-coverage": coverage.coverage,
  };

  const suite = validateEvaluationSuite({
    version: "0.1",
    id: "core-language-v02-gate",
    task: "general",
    description: "Held-out candidate gate for Hercules Core language foundation v0.2.",
    thresholds: [
      {metric: "top1-accuracy", op: "gte", value: 0.35},
      {metric: "cross-entropy-ratio", op: "lte", value: 0.85},
      {metric: "token-coverage", op: "gte", value: 0.8},
    ],
    sourceCommit,
  });
  if (!suite.ok) {
    throw new Error("language evaluation suite invalid: " + suite.errors.join("; "));
  }

  const evidence = {
    evaluationDataset: {
      id: evaluationManifest.dataset.id,
      contentSha256: evaluationManifest.dataset.contentSha256,
      manifestFingerprint: evaluationManifest.fingerprint,
    },
    tokenizer: {
      vocabularySize: tokenizer.vocabulary.length,
      coverage,
    },
    language: metricsRaw,
    samples: [
      generateText(tokenizer, languageModel, "Hercules ", {maxTokens: 24}),
      generateText(tokenizer, languageModel, "The model plane ", {maxTokens: 24}),
    ],
  };

  const evaluation = validateEvaluationResult({
    version: "0.1",
    id: "core-language-v02-result",
    suiteId: suite.suite.id,
    suiteFingerprint: suite.fingerprint,
    checkpointSha256: artifactSha256,
    metrics,
    evidenceSha256: sha256Bytes(Buffer.from(stableStringify(evidence), "utf8")),
    createdAt,
  });
  if (!evaluation.ok) {
    throw new Error("language evaluation result invalid: " + evaluation.errors.join("; "));
  }

  const scored = scoreEvaluation({suite: suite.suite, result: evaluation.result});

  return {
    ok: scored.ok,
    candidateReady: scored.ok,
    tokenizer,
    languageModel,
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
  const outDir = resolve(process.argv[4] ?? ".hercules-training/language-foundation-v0.2");

  const [trainingText, evaluationText] = await Promise.all([
    readFile(trainingPath, "utf8"),
    readFile(evaluationPath, "utf8"),
  ]);

  const build = buildLanguageFoundation({trainingText, evaluationText, sourceCommit, createdAt});
  if (!build.ok) {
    throw new Error("Hercules language foundation missed candidate gate");
  }

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
    version: "0.2-candidate",
    checkpointSha256: build.checkpoint.checkpoint.artifactSha256,
    checkpointBytes: build.checkpoint.checkpoint.bytes,
    vocabularySize: build.tokenizer.vocabulary.length,
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
