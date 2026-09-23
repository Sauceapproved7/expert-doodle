import {createHash} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {join, resolve} from "node:path";
import {validateModelManifest} from "../hercules-models/schema.mjs";
import {createTrainingJob} from "./planner.mjs";
import {
  validateCheckpoint,
  validateDatasetManifest,
  validateEvaluationResult,
  validateEvaluationSuite,
} from "./schema.mjs";
import {scoreEvaluation} from "./evaluation.mjs";
import {stableStringify} from "./hash.mjs";
import {
  evaluateBootstrapClassifier,
  evaluateBootstrapRetriever,
  trainBootstrapClassifier,
  trainBootstrapRetriever,
} from "./native-bootstrap-models.mjs";

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function shortFamily(family) {
  return family.replace(/^hercules-/, "");
}

function candidateId(family) {
  return family + "-bootstrap";
}

function buildDatasetManifest({
  id,
  description,
  sourceUri,
  payload,
  recordCount,
  sourceCommit,
  createdAt,
  notes,
}) {
  const checked = validateDatasetManifest({
    version: "0.1",
    id,
    description,
    sourceUri,
    sourceType: "hercules-authored",
    contentSha256: sha256Bytes(Buffer.from(stableStringify(payload) + "\n", "utf8")),
    recordCount,
    license: "Apache-2.0",
    rightsBasis: "Original Hercules project training material committed in the canonical repository.",
    trainingAllowed: true,
    createdAt,
    provenance: {
      origin: "Hercules canonical repository",
      acquiredBy: "Sauceapproved7",
      sourceCommit,
      notes,
    },
  });
  if (!checked.ok) {
    throw new Error("dataset failed provenance gate: " + checked.errors.join("; "));
  }
  return checked;
}

function buildClassifier(config) {
  const model = trainBootstrapClassifier(config.train, {
    alpha: 1,
    format: "hercules-" + config.capability + "/0.1",
  });
  const detailed = evaluateBootstrapClassifier(model, config.eval);
  return {model, detailed};
}

function buildRetriever(config) {
  const model = trainBootstrapRetriever(config.documents);
  const detailed = evaluateBootstrapRetriever(model, config.eval);
  return {model, detailed};
}

export function buildNativeFamilyBaselines({
  configText,
  sourceCommit,
  createdAt,
}) {
  if (!/^[a-f0-9]{40}$/.test(sourceCommit ?? "")) {
    throw new TypeError("sourceCommit must be a 40-character git SHA");
  }
  if (!createdAt) throw new TypeError("createdAt is required");

  const parsed = JSON.parse(configText);
  if (parsed.version !== "0.1" || !parsed.families || typeof parsed.families !== "object") {
    throw new Error("unsupported family bootstrap configuration");
  }

  const builds = [];

  for (const family of Object.keys(parsed.families).sort()) {
    const config = parsed.families[family];
    const short = shortFamily(family);
    const modelId = candidateId(family);
    const trainingPayload = config.kind === "retrieval" ? config.documents : config.train;
    const evaluationPayload = config.eval;

    const trainManifest = buildDatasetManifest({
      id: short + "-bootstrap-train",
      description: "Hercules-authored bootstrap training material for " + family + ".",
      sourceUri: "repo://hercules-training/bootstrap/family-bootstrap.json#families/" + family,
      payload: trainingPayload,
      recordCount: trainingPayload.length,
      sourceCommit,
      createdAt,
      notes: "Native bootstrap capability: " + config.capability + ". No third-party model weights.",
    });

    const evalManifest = buildDatasetManifest({
      id: short + "-bootstrap-eval",
      description: "Hercules-authored held-out bootstrap evaluation material for " + family + ".",
      sourceUri: "repo://hercules-training/bootstrap/family-bootstrap.json#families/" + family + "/eval",
      payload: evaluationPayload,
      recordCount: evaluationPayload.length,
      sourceCommit,
      createdAt,
      notes: "Held out from training for deterministic bootstrap evaluation.",
    });

    const planned = createTrainingJob({
      id: short + "-bootstrap-job",
      modelId,
      task: config.task,
      datasetManifests: [trainManifest.dataset],
      seed: 11,
      codeCommit: sourceCommit,
      trainer: {
        engine: "hercules-native",
        version: "0.1",
        entrypoint: "hercules-training/native-bootstrap-models.mjs",
      },
      hyperparameters: config.kind === "retrieval"
        ? {algorithm: "tf-idf-cosine"}
        : {algorithm: "multinomial-naive-bayes", alpha: 1},
      createdAt,
    });

    const trained = config.kind === "retrieval"
      ? buildRetriever(config)
      : buildClassifier(config);

    const modelBytes = Buffer.from(stableStringify(trained.model) + "\n", "utf8");
    const artifactSha256 = sha256Bytes(modelBytes);

    const checkpoint = validateCheckpoint({
      version: "0.1",
      id: short + "-bootstrap-checkpoint",
      modelId,
      jobId: planned.job.id,
      jobFingerprint: planned.fingerprint,
      artifactSha256,
      bytes: modelBytes.length,
      format: trained.model.format,
      framework: "hercules-native-js",
      parentCheckpointSha256: null,
      createdAt,
      sourceCommit,
    });
    if (!checkpoint.ok) {
      throw new Error("checkpoint invalid for " + family + ": " + checkpoint.errors.join("; "));
    }

    const suite = validateEvaluationSuite({
      version: "0.1",
      id: short + "-bootstrap-gate",
      task: config.task,
      description: "Held-out bootstrap gate for " + family + " capability " + config.capability + ".",
      thresholds: [
        {metric: "accuracy", op: "gte", value: 0.8},
        {metric: "error-rate", op: "lte", value: 0.2},
      ],
      sourceCommit,
    });
    if (!suite.ok) {
      throw new Error("evaluation suite invalid for " + family + ": " + suite.errors.join("; "));
    }

    const evidence = {
      family,
      capability: config.capability,
      kind: config.kind,
      evaluationDataset: {
        id: evalManifest.dataset.id,
        contentSha256: evalManifest.dataset.contentSha256,
        manifestFingerprint: evalManifest.fingerprint,
      },
      predictions: trained.detailed.rows,
    };

    const evaluation = validateEvaluationResult({
      version: "0.1",
      id: short + "-bootstrap-eval-result",
      suiteId: suite.suite.id,
      suiteFingerprint: suite.fingerprint,
      checkpointSha256: artifactSha256,
      metrics: {
        accuracy: trained.detailed.accuracy,
        "error-rate": 1 - trained.detailed.accuracy,
      },
      evidenceSha256: sha256Bytes(Buffer.from(stableStringify(evidence), "utf8")),
      createdAt,
    });
    if (!evaluation.ok) {
      throw new Error("evaluation result invalid for " + family + ": " + evaluation.errors.join("; "));
    }

    const score = scoreEvaluation({suite: suite.suite, result: evaluation.result});

    const candidate = validateModelManifest({
      version: "0.1",
      id: modelId,
      family,
      description: config.description,
      tasks: [config.task],
      state: "candidate",
      origin: "hercules-native",
      priority: 100,
      runtime: {kind: "embedded", endpoint: null},
      checkpoint: "sha256:" + artifactSha256,
      provenance: [
        "Hercules-authored bootstrap baseline",
        "capability:" + config.capability,
        "job:" + planned.job.id,
        "checkpoint:" + checkpoint.checkpoint.id,
      ].join(" | "),
    });
    if (!candidate.ok) {
      throw new Error("candidate model manifest invalid for " + family + ": " + candidate.errors.join("; "));
    }

    builds.push({
      ok: score.ok,
      family,
      capability: config.capability,
      kind: config.kind,
      model: trained.model,
      modelBytes,
      candidate: candidate.model,
      trainManifest: {manifest: trainManifest.dataset, fingerprint: trainManifest.fingerprint},
      evalManifest: {manifest: evalManifest.dataset, fingerprint: evalManifest.fingerprint},
      job: planned,
      checkpoint: {checkpoint: checkpoint.checkpoint, fingerprint: checkpoint.fingerprint},
      suite: {suite: suite.suite, fingerprint: suite.fingerprint},
      evaluation: {
        result: evaluation.result,
        fingerprint: evaluation.fingerprint,
        evidence,
        score,
      },
    });
  }

  return {
    ok: builds.length === 7 && builds.every((build) => build.ok),
    builds,
  };
}

async function main() {
  const sourceCommit = process.env.HERCULES_SOURCE_COMMIT ?? process.env.GITHUB_SHA;
  const createdAt = process.env.HERCULES_CREATED_AT ?? new Date().toISOString();
  const configPath = resolve(process.argv[2] ?? "hercules-training/bootstrap/family-bootstrap.json");
  const outDir = resolve(process.argv[3] ?? ".hercules-training/bootstrap-family-models");

  const configText = await readFile(configPath, "utf8");
  const result = buildNativeFamilyBaselines({configText, sourceCommit, createdAt});

  if (!result.ok) {
    const failed = result.builds
      .filter((build) => !build.ok)
      .map((build) => build.family)
      .join(", ");
    throw new Error("native family bootstrap gates failed: " + failed);
  }

  await mkdir(outDir, {recursive: true});
  for (const build of result.builds) {
    const familyDir = join(outDir, build.family);
    await mkdir(familyDir, {recursive: true});
    await Promise.all([
      writeFile(join(familyDir, "model.json"), build.modelBytes),
      writeFile(join(familyDir, "candidate-manifest.json"), JSON.stringify(build.candidate, null, 2) + "\n"),
      writeFile(join(familyDir, "training-evidence.json"), JSON.stringify({
        family: build.family,
        capability: build.capability,
        kind: build.kind,
        trainManifest: build.trainManifest,
        evalManifest: build.evalManifest,
        job: build.job,
        checkpoint: build.checkpoint,
        suite: build.suite,
        evaluation: build.evaluation,
      }, null, 2) + "\n"),
    ]);
  }

  const summary = {
    ok: true,
    count: result.builds.length,
    models: result.builds.map((build) => ({
      family: build.family,
      modelId: build.candidate.id,
      capability: build.capability,
      checkpointSha256: build.checkpoint.checkpoint.artifactSha256,
      accuracy: build.evaluation.result.metrics.accuracy,
      state: build.candidate.state,
    })),
  };
  await writeFile(join(outDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
