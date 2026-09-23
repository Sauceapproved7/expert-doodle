import {createHash} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {join, resolve} from "node:path";
import {HERCULES_MODEL_SLOTS} from "../hercules-models/catalog.mjs";
import {decideActivation} from "./activation.mjs";
import {stableStringify} from "./hash.mjs";
import {createTrainingJob} from "./planner.mjs";
import {
  evaluateRetriever,
  trainNativeRetriever,
} from "./native-retrieval.mjs";
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

export function buildNativeRetriever({
  documentsText,
  evaluationText,
  sourceCommit,
  createdAt,
}) {
  const documents = parseJsonl(documentsText);
  const evaluationCases = parseJsonl(evaluationText);

  const documentsManifest = validateDatasetManifest({
    version: "0.1",
    id: "retrieval-documents",
    description: "Hercules-authored corpus for native sparse retrieval training.",
    sourceUri: "repo://hercules-training/bootstrap/retrieval-documents.jsonl",
    sourceType: "hercules-authored",
    contentSha256: sha256Bytes(Buffer.from(documentsText, "utf8")),
    recordCount: documents.length,
    license: "Apache-2.0",
    rightsBasis: "Original Hercules project training material committed in the canonical repository.",
    trainingAllowed: true,
    createdAt,
    provenance: {
      origin: "Hercules canonical repository",
      acquiredBy: "Sauceapproved7",
      sourceCommit,
      notes: "Original document corpus; no third-party embeddings or model weights.",
    },
  });
  if (!documentsManifest.ok) {
    throw new Error("retrieval corpus failed provenance gate: " + documentsManifest.errors.join("; "));
  }

  const evaluationManifest = validateDatasetManifest({
    version: "0.1",
    id: "retrieval-eval",
    description: "Hercules-authored held-out queries for native retrieval evaluation.",
    sourceUri: "repo://hercules-training/bootstrap/retrieval-eval.jsonl",
    sourceType: "hercules-authored",
    contentSha256: sha256Bytes(Buffer.from(evaluationText, "utf8")),
    recordCount: evaluationCases.length,
    license: "Apache-2.0",
    rightsBasis: "Original Hercules project evaluation material committed in the canonical repository.",
    trainingAllowed: true,
    createdAt,
    provenance: {
      origin: "Hercules canonical repository",
      acquiredBy: "Sauceapproved7",
      sourceCommit,
      notes: "Held-out evaluation queries; not used to learn IDF weights.",
    },
  });
  if (!evaluationManifest.ok) {
    throw new Error("retrieval evaluation corpus failed provenance gate: " + evaluationManifest.errors.join("; "));
  }

  const planned = createTrainingJob({
    id: "retrieval-bootstrap",
    modelId: "hercules-retrieval",
    task: "rerank",
    datasetManifests: [documentsManifest.dataset],
    seed: 7,
    codeCommit: sourceCommit,
    trainer: {
      engine: "hercules-native",
      version: "0.1",
      entrypoint: "hercules-training/native-retrieval.mjs",
    },
    hyperparameters: {
      algorithm: "tfidf-word-char3-cosine",
      normalization: "l2",
    },
    createdAt,
  });

  const model = trainNativeRetriever(documents);
  const modelBytes = Buffer.from(stableStringify(model) + "\n", "utf8");
  const artifactSha256 = sha256Bytes(modelBytes);

  const checkpointCheck = validateCheckpoint({
    version: "0.1",
    id: "retrieval-bootstrap-checkpoint",
    modelId: "hercules-retrieval",
    jobId: planned.job.id,
    jobFingerprint: planned.fingerprint,
    artifactSha256,
    bytes: modelBytes.length,
    format: "hercules-native-sparse-retrieval",
    framework: "hercules-native-js",
    parentCheckpointSha256: null,
    createdAt,
    sourceCommit,
  });
  if (!checkpointCheck.ok) {
    throw new Error("retrieval checkpoint invalid: " + checkpointCheck.errors.join("; "));
  }

  const detailed = evaluateRetriever(model, documents, evaluationCases);
  const metrics = {
    top1: detailed.top1,
    mrr: detailed.mrr,
  };

  const suiteCheck = validateEvaluationSuite({
    version: "0.1",
    id: "retrieval-bootstrap-gate",
    task: "rerank",
    description: "Held-out ranking gate for Hercules Retrieval v0.1.",
    thresholds: [
      {metric: "top1", op: "gte", value: 0.8},
      {metric: "mrr", op: "gte", value: 0.9},
    ],
    sourceCommit,
  });
  if (!suiteCheck.ok) {
    throw new Error("retrieval evaluation suite invalid: " + suiteCheck.errors.join("; "));
  }

  const evaluationEvidence = {
    dataset: {
      id: evaluationManifest.dataset.id,
      contentSha256: evaluationManifest.dataset.contentSha256,
      manifestFingerprint: evaluationManifest.fingerprint,
    },
    rows: detailed.rows,
  };

  const resultCheck = validateEvaluationResult({
    version: "0.1",
    id: "retrieval-bootstrap-eval",
    suiteId: suiteCheck.suite.id,
    suiteFingerprint: suiteCheck.fingerprint,
    checkpointSha256: artifactSha256,
    metrics,
    evidenceSha256: sha256Bytes(Buffer.from(stableStringify(evaluationEvidence), "utf8")),
    createdAt,
  });
  if (!resultCheck.ok) {
    throw new Error("retrieval evaluation result invalid: " + resultCheck.errors.join("; "));
  }

  const decision = decideActivation({
    model: canonicalModel("hercules-retrieval"),
    checkpoint: checkpointCheck.checkpoint,
    evaluations: [resultCheck.result],
    requiredSuites: [suiteCheck.suite],
    runtime: {kind: "embedded", endpoint: null},
  });

  return {
    ok: decision.ok,
    model,
    modelBytes,
    documentsManifest: {
      manifest: documentsManifest.dataset,
      fingerprint: documentsManifest.fingerprint,
    },
    evaluationManifest: {
      manifest: evaluationManifest.dataset,
      fingerprint: evaluationManifest.fingerprint,
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
  const documentsPath = resolve(
    process.argv[2] ?? "hercules-training/bootstrap/retrieval-documents.jsonl",
  );
  const evaluationPath = resolve(
    process.argv[3] ?? "hercules-training/bootstrap/retrieval-eval.jsonl",
  );
  const outDir = resolve(
    process.argv[4] ?? ".hercules-training/bootstrap-retrieval",
  );

  const [documentsText, evaluationText] = await Promise.all([
    readFile(documentsPath, "utf8"),
    readFile(evaluationPath, "utf8"),
  ]);

  const build = buildNativeRetriever({
    documentsText,
    evaluationText,
    sourceCommit,
    createdAt,
  });

  if (!build.ok) {
    throw new Error("native retrieval failed activation gate: " + build.decision.reasons.join("; "));
  }

  await mkdir(outDir, {recursive: true});
  await Promise.all([
    writeFile(join(outDir, "model.json"), build.modelBytes),
    writeFile(join(outDir, "training-evidence.json"), JSON.stringify({
      documentsManifest: build.documentsManifest,
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
    modelId: "hercules-retrieval",
    checkpointSha256: build.checkpoint.checkpoint.artifactSha256,
    top1: build.evaluation.result.metrics.top1,
    mrr: build.evaluation.result.metrics.mrr,
    output: outDir,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
