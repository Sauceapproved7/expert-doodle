import {createHash} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {join, resolve} from "node:path";
import {HERCULES_MODEL_SLOTS} from "../hercules-models/catalog.mjs";
import {decideActivation} from "./activation.mjs";
import {scoreEvaluation} from "./evaluation.mjs";
import {stableStringify} from "./hash.mjs";
import {createTrainingJob} from "./planner.mjs";
import {
  validateCheckpoint,
  validateDatasetManifest,
  validateEvaluationResult,
  validateEvaluationSuite,
} from "./schema.mjs";
import {
  evaluateFamilyClassifier,
  trainFamilyClassifier,
} from "./native-family-classifier.mjs";

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalModel(id) {
  const model = HERCULES_MODEL_SLOTS.find((item) => item.id === id);
  if (!model) throw new Error("unknown canonical model: " + id);
  return structuredClone(model);
}

function shortId(modelId) {
  return modelId.replace(/^hercules-/, "");
}

function manifest({id, description, payload, sourceUri, sourceCommit, createdAt, notes}) {
  const checked = validateDatasetManifest({
    version: "0.1",
    id,
    description,
    sourceUri,
    sourceType: "hercules-authored",
    contentSha256: sha256Bytes(Buffer.from(stableStringify(payload) + "\n", "utf8")),
    recordCount: payload.length,
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
  if (!checked.ok) throw new Error("dataset failed provenance gate: " + checked.errors.join("; "));
  return checked;
}

export function buildFiveNativeFamilies({configText, sourceCommit, createdAt}) {
  if (!/^[a-f0-9]{40}$/.test(sourceCommit ?? "")) {
    throw new TypeError("sourceCommit must be a 40-character git SHA");
  }
  if (!createdAt) throw new TypeError("createdAt is required");

  const config = JSON.parse(configText);
  const entries = Object.entries(config.families ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (config.version !== "0.1" || entries.length !== 5) {
    throw new Error("expected five-family classifier configuration v0.1");
  }

  const builds = entries.map(([modelId, family]) => {
    const short = shortId(modelId);
    const trainManifest = manifest({
      id: short + "-v01-train",
      description: "Hercules-authored training corpus for " + modelId + " v0.1.",
      payload: family.train,
      sourceUri: "repo://hercules-training/bootstrap/five-family-classifiers.json#families/" + modelId + "/train",
      sourceCommit,
      createdAt,
      notes: "Original Hercules examples for capability " + family.capability + ".",
    });
    const evalManifest = manifest({
      id: short + "-v01-eval",
      description: "Hercules-authored held-out evaluation corpus for " + modelId + " v0.1.",
      payload: family.eval,
      sourceUri: "repo://hercules-training/bootstrap/five-family-classifiers.json#families/" + modelId + "/eval",
      sourceCommit,
      createdAt,
      notes: "Held out from training and used only for evaluation.",
    });

    const planned = createTrainingJob({
      id: short + "-v01-job",
      modelId,
      task: family.task,
      datasetManifests: [trainManifest.dataset],
      seed: 17,
      codeCommit: sourceCommit,
      trainer: {
        engine: "hercules-native",
        version: "0.1",
        entrypoint: "hercules-training/native-family-classifier.mjs",
      },
      hyperparameters: {
        algorithm: "multinomial-naive-bayes",
        alpha: 1,
        capability: family.capability,
      },
      createdAt,
    });

    const model = trainFamilyClassifier(family.train, {
      alpha: 1,
      format: "hercules-" + short + "-classifier/0.1",
    });
    const modelBytes = Buffer.from(stableStringify(model) + "\n", "utf8");
    const artifactSha256 = sha256Bytes(modelBytes);

    const checkpoint = validateCheckpoint({
      version: "0.1",
      id: short + "-v01-checkpoint",
      modelId,
      jobId: planned.job.id,
      jobFingerprint: planned.fingerprint,
      artifactSha256,
      bytes: modelBytes.length,
      format: model.format,
      framework: "hercules-native-js",
      parentCheckpointSha256: null,
      createdAt,
      sourceCommit,
    });
    if (!checkpoint.ok) throw new Error("invalid checkpoint for " + modelId + ": " + checkpoint.errors.join("; "));

    const detailed = evaluateFamilyClassifier(model, family.eval);
    const suite = validateEvaluationSuite({
      version: "0.1",
      id: short + "-v01-gate",
      task: family.task,
      description: "Held-out v0.1 gate for " + modelId + " capability " + family.capability + ".",
      thresholds: [
        {metric: "accuracy", op: "gte", value: 0.8},
        {metric: "error-rate", op: "lte", value: 0.2},
      ],
      sourceCommit,
    });
    if (!suite.ok) throw new Error("invalid suite for " + modelId + ": " + suite.errors.join("; "));

    const evidence = {
      modelId,
      capability: family.capability,
      evaluationDataset: {
        id: evalManifest.dataset.id,
        contentSha256: evalManifest.dataset.contentSha256,
        manifestFingerprint: evalManifest.fingerprint,
      },
      predictions: detailed.rows,
    };

    const evaluation = validateEvaluationResult({
      version: "0.1",
      id: short + "-v01-result",
      suiteId: suite.suite.id,
      suiteFingerprint: suite.fingerprint,
      checkpointSha256: artifactSha256,
      metrics: {
        accuracy: detailed.accuracy,
        "error-rate": detailed.errorRate,
      },
      evidenceSha256: sha256Bytes(Buffer.from(stableStringify(evidence), "utf8")),
      createdAt,
    });
    if (!evaluation.ok) throw new Error("invalid evaluation for " + modelId + ": " + evaluation.errors.join("; "));

    const score = scoreEvaluation({suite: suite.suite, result: evaluation.result});
    const decision = decideActivation({
      model: canonicalModel(modelId),
      checkpoint: checkpoint.checkpoint,
      evaluations: [evaluation.result],
      requiredSuites: [suite.suite],
      runtime: {kind: "embedded", endpoint: null},
    });

    return {
      ok: score.ok && decision.ok,
      modelId,
      task: family.task,
      capability: family.capability,
      description: family.description,
      model,
      modelBytes,
      trainManifest: {manifest: trainManifest.dataset, fingerprint: trainManifest.fingerprint},
      evalManifest: {manifest: evalManifest.dataset, fingerprint: evalManifest.fingerprint},
      job: planned,
      checkpoint: {checkpoint: checkpoint.checkpoint, fingerprint: checkpoint.fingerprint},
      suite: {suite: suite.suite, fingerprint: suite.fingerprint},
      evaluation: {result: evaluation.result, fingerprint: evaluation.fingerprint, evidence, score},
      decision,
    };
  });

  return {ok: builds.length === 5 && builds.every((build) => build.ok), builds};
}

async function main() {
  const sourceCommit = process.env.HERCULES_SOURCE_COMMIT ?? process.env.GITHUB_SHA;
  const createdAt = process.env.HERCULES_CREATED_AT ?? new Date().toISOString();
  const configPath = resolve(process.argv[2] ?? "hercules-training/bootstrap/five-family-classifiers.json");
  const outDir = resolve(process.argv[3] ?? ".hercules-training/five-native-families");

  const result = buildFiveNativeFamilies({
    configText: await readFile(configPath, "utf8"),
    sourceCommit,
    createdAt,
  });

  if (!result.ok) {
    throw new Error("one or more five-family native activation gates failed");
  }

  await mkdir(outDir, {recursive: true});
  for (const build of result.builds) {
    const familyDir = join(outDir, build.modelId);
    await mkdir(familyDir, {recursive: true});
    await Promise.all([
      writeFile(join(familyDir, "model.json"), build.modelBytes),
      writeFile(join(familyDir, "training-evidence.json"), JSON.stringify({
        modelId: build.modelId,
        task: build.task,
        capability: build.capability,
        description: build.description,
        trainManifest: build.trainManifest,
        evalManifest: build.evalManifest,
        job: build.job,
        checkpoint: build.checkpoint,
        suite: build.suite,
        evaluation: build.evaluation,
        decision: build.decision,
      }, null, 2) + "\n"),
    ]);
  }

  const summary = {
    ok: true,
    count: result.builds.length,
    models: result.builds.map((build) => ({
      modelId: build.modelId,
      task: build.task,
      capability: build.capability,
      checkpointSha256: build.checkpoint.checkpoint.artifactSha256,
      checkpointBytes: build.checkpoint.checkpoint.bytes,
      accuracy: build.evaluation.result.metrics.accuracy,
      errorRate: build.evaluation.result.metrics["error-rate"],
      activationReady: build.decision.ok,
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
