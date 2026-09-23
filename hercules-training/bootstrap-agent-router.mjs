import {createHash} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {join, resolve} from "node:path";
import {trainAgentRouter, evaluateAgentRouter} from "./native-agent-router.mjs";
import {
  validateDatasetManifest,
  validateTrainingJob,
  validateCheckpoint,
  validateEvaluationSuite,
  validateEvaluationResult,
} from "./schema.mjs";
import {scoreEvaluation} from "./evaluation.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function reproduceNativeAgentRouter({
  root = "hercules-training/bootstrap",
  outDir = ".hercules-training/bootstrap-agent-router",
} = {}) {
  const base = resolve(root);
  const [
    trainText,
    evalText,
    datasetManifest,
    jobManifest,
    checkpointManifest,
    suiteManifest,
    evaluationResult,
    evidenceText,
  ] = await Promise.all([
    readFile(join(base, "agent-router-train.json"), "utf8"),
    readFile(join(base, "agent-router-eval.json"), "utf8"),
    loadJson(join(base, "agent-router-dataset-manifest.json")),
    loadJson(join(base, "agent-router-job.json")),
    loadJson(join(base, "agent-router-checkpoint.json")),
    loadJson(join(base, "agent-router-eval-suite.json")),
    loadJson(join(base, "agent-router-eval-result.json")),
    readFile(join(base, "agent-router-evaluation-evidence.json"), "utf8"),
  ]);

  const datasetCheck = validateDatasetManifest(datasetManifest);
  if (!datasetCheck.ok) throw new Error("dataset manifest invalid: " + datasetCheck.errors.join("; "));
  if (sha256(trainText) !== datasetManifest.contentSha256) {
    throw new Error("training dataset content hash mismatch");
  }

  const jobCheck = validateTrainingJob(jobManifest);
  if (!jobCheck.ok) throw new Error("training job invalid: " + jobCheck.errors.join("; "));
  const ref = jobManifest.datasets[0];
  if (
    ref.id !== datasetManifest.id ||
    ref.contentSha256 !== datasetManifest.contentSha256 ||
    ref.manifestFingerprint !== datasetCheck.fingerprint
  ) {
    throw new Error("training job dataset lineage mismatch");
  }

  const trainRecords = JSON.parse(trainText);
  const evalRecords = JSON.parse(evalText);
  const model = trainAgentRouter(trainRecords, {alpha: jobManifest.hyperparameters.alpha});
  const modelText = JSON.stringify(model, null, 2) + "\n";

  const checkpointCheck = validateCheckpoint(checkpointManifest);
  if (!checkpointCheck.ok) throw new Error("checkpoint manifest invalid: " + checkpointCheck.errors.join("; "));
  if (checkpointManifest.jobFingerprint !== jobCheck.fingerprint) {
    throw new Error("checkpoint job fingerprint mismatch");
  }
  if (Buffer.byteLength(modelText) !== checkpointManifest.bytes) {
    throw new Error("checkpoint byte size mismatch");
  }
  if (sha256(modelText) !== checkpointManifest.artifactSha256) {
    throw new Error("checkpoint hash mismatch");
  }

  const suiteCheck = validateEvaluationSuite(suiteManifest);
  if (!suiteCheck.ok) throw new Error("evaluation suite invalid: " + suiteCheck.errors.join("; "));
  const resultCheck = validateEvaluationResult(evaluationResult);
  if (!resultCheck.ok) throw new Error("evaluation result invalid: " + resultCheck.errors.join("; "));
  if (evaluationResult.suiteFingerprint !== suiteCheck.fingerprint) {
    throw new Error("evaluation suite fingerprint mismatch");
  }
  if (evaluationResult.checkpointSha256 !== checkpointManifest.artifactSha256) {
    throw new Error("evaluation checkpoint mismatch");
  }
  if (sha256(evidenceText) !== evaluationResult.evidenceSha256) {
    throw new Error("evaluation evidence hash mismatch");
  }

  const evaluation = evaluateAgentRouter(model, evalRecords);
  if (evaluation.accuracy !== evaluationResult.metrics.accuracy) {
    throw new Error("recorded evaluation accuracy does not reproduce");
  }

  const scored = scoreEvaluation({suite: suiteManifest, result: evaluationResult});
  if (!scored.ok) {
    throw new Error("bootstrap evaluation gate failed");
  }

  const output = resolve(outDir);
  await mkdir(output, {recursive: true});
  await Promise.all([
    writeFile(join(output, "model.json"), modelText),
    writeFile(join(output, "reproduction.json"), JSON.stringify({
      ok: true,
      modelId: checkpointManifest.modelId,
      checkpointSha256: checkpointManifest.artifactSha256,
      bytes: checkpointManifest.bytes,
      trainingRecords: trainRecords.length,
      evaluationRecords: evalRecords.length,
      accuracy: evaluation.accuracy,
      bootstrapGatePassed: true,
      productionActivated: false,
      limitation: "Narrow bootstrap router only; not a general-purpose language model.",
    }, null, 2) + "\n"),
  ]);

  return {
    ok: true,
    modelId: checkpointManifest.modelId,
    checkpointSha256: checkpointManifest.artifactSha256,
    bytes: checkpointManifest.bytes,
    trainingRecords: trainRecords.length,
    evaluationRecords: evalRecords.length,
    accuracy: evaluation.accuracy,
    scored,
    output,
  };
}

async function main() {
  const result = await reproduceNativeAgentRouter();
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
