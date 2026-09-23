import http from "node:http";
import {timingSafeEqual} from "node:crypto";
import {TrainingEvidenceStore} from "./store.mjs";
import {
  validateCheckpoint,
  validateDatasetManifest,
  validateEvaluationResult,
  validateEvaluationSuite,
} from "./schema.mjs";
import {createTrainingJob} from "./planner.mjs";
import {decideActivation} from "./activation.mjs";

const MAX_BODY_BYTES = 1024 * 1024;

function send(res, status, body) {
  res.writeHead(status, {"content-type": "application/json; charset=utf-8"});
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      throw Object.assign(new Error("request body too large"), {statusCode: 413});
    }
  }
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw Object.assign(new Error("invalid JSON"), {statusCode: 400});
  }
}

function requireToken(req, token) {
  const header = req.headers.authorization ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = Buffer.from(token);
  const actual = Buffer.from(supplied);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw Object.assign(new Error("unauthorized"), {statusCode: 401});
  }
}

function checked(result, label) {
  if (!result.ok) {
    throw Object.assign(new Error(label + ": " + result.errors.join("; ")), {statusCode: 400});
  }
  return result;
}

export function createTrainingControlService({root, token}) {
  if (!root) throw new TypeError("root is required");
  if (typeof token !== "string" || token.length < 16) {
    throw new TypeError("control token must be at least 16 characters");
  }

  const store = new TrainingEvidenceStore(root);

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://hercules-training.local");

      if (req.method === "GET" && url.pathname === "/health") {
        const [datasets, jobs, checkpoints, evaluations] = await Promise.all([
          store.list("datasets"),
          store.list("jobs"),
          store.list("checkpoints"),
          store.list("evaluations"),
        ]);
        return send(res, 200, {
          ok: true,
          service: "hercules-training-control",
          version: "0.1",
          counts: {
            datasets: datasets.length,
            jobs: jobs.length,
            checkpoints: checkpoints.length,
            evaluations: evaluations.length,
          },
        });
      }

      requireToken(req, token);

      if (req.method === "GET" && url.pathname === "/v1/datasets") {
        return send(res, 200, {datasets: await store.list("datasets")});
      }

      if (req.method === "POST" && url.pathname === "/v1/datasets") {
        const check = checked(validateDatasetManifest(await readBody(req)), "invalid dataset");
        const record = {manifest: check.dataset, fingerprint: check.fingerprint};
        await store.save("datasets", check.dataset.id, record);
        return send(res, 201, record);
      }

      if (req.method === "POST" && url.pathname === "/v1/jobs") {
        const body = await readBody(req);
        if (!Array.isArray(body.datasetIds) || body.datasetIds.length === 0) {
          throw Object.assign(new Error("datasetIds is required"), {statusCode: 400});
        }
        const datasets = await Promise.all(
          body.datasetIds.map((id) => store.get("datasets", id).then((record) => record.manifest)),
        );
        const planned = createTrainingJob({
          id: body.id,
          modelId: body.modelId,
          task: body.task,
          datasetManifests: datasets,
          seed: body.seed,
          codeCommit: body.codeCommit,
          trainer: body.trainer,
          hyperparameters: body.hyperparameters ?? {},
          createdAt: body.createdAt,
        });
        await store.save("jobs", planned.job.id, planned);
        return send(res, 201, planned);
      }

      if (req.method === "POST" && url.pathname === "/v1/checkpoints") {
        const check = checked(validateCheckpoint(await readBody(req)), "invalid checkpoint");
        const jobRecord = await store.get("jobs", check.checkpoint.jobId);
        if (jobRecord.fingerprint !== check.checkpoint.jobFingerprint) {
          throw Object.assign(new Error("checkpoint job fingerprint mismatch"), {statusCode: 409});
        }
        const record = {checkpoint: check.checkpoint, fingerprint: check.fingerprint};
        await store.save("checkpoints", check.checkpoint.id, record);
        return send(res, 201, record);
      }

      if (req.method === "POST" && url.pathname === "/v1/suites") {
        const check = checked(validateEvaluationSuite(await readBody(req)), "invalid evaluation suite");
        const record = {suite: check.suite, fingerprint: check.fingerprint};
        await store.save("suites", check.suite.id, record);
        return send(res, 201, record);
      }

      if (req.method === "POST" && url.pathname === "/v1/evaluations") {
        const check = checked(validateEvaluationResult(await readBody(req)), "invalid evaluation result");
        const suiteRecord = await store.get("suites", check.result.suiteId);
        if (suiteRecord.fingerprint !== check.result.suiteFingerprint) {
          throw Object.assign(new Error("evaluation suite fingerprint mismatch"), {statusCode: 409});
        }
        const checkpoints = await store.list("checkpoints");
        if (!checkpoints.some((record) => record.checkpoint.artifactSha256 === check.result.checkpointSha256)) {
          throw Object.assign(new Error("evaluation references unknown checkpoint"), {statusCode: 409});
        }
        const record = {result: check.result, fingerprint: check.fingerprint};
        await store.save("evaluations", check.result.id, record);
        return send(res, 201, record);
      }

      if (req.method === "POST" && url.pathname === "/v1/activations/check") {
        const body = await readBody(req);
        const checkpointRecord = await store.get("checkpoints", body.checkpointId);
        if (!Array.isArray(body.requiredSuiteIds) || body.requiredSuiteIds.length === 0) {
          throw Object.assign(new Error("requiredSuiteIds is required"), {statusCode: 400});
        }
        const suiteRecords = await Promise.all(body.requiredSuiteIds.map((id) => store.get("suites", id)));
        const evaluationRecords = await store.list("evaluations");
        const evaluations = suiteRecords.map((suiteRecord) => {
          const match = evaluationRecords.find((record) =>
            record.result.suiteId === suiteRecord.suite.id &&
            record.result.checkpointSha256 === checkpointRecord.checkpoint.artifactSha256
          );
          return match?.result ?? null;
        }).filter(Boolean);

        const decision = decideActivation({
          model: body.model,
          checkpoint: checkpointRecord.checkpoint,
          evaluations,
          requiredSuites: suiteRecords.map((record) => record.suite),
          runtime: body.runtime,
        });

        if (body.activationId) {
          await store.save("activations", body.activationId, {
            id: body.activationId,
            checkpointId: body.checkpointId,
            requiredSuiteIds: body.requiredSuiteIds,
            decision,
          });
        }
        return send(res, decision.ok ? 200 : 409, decision);
      }

      return send(res, 404, {error: "not_found"});
    } catch (error) {
      let status = error?.statusCode ?? 500;
      if (error?.code === "ENOENT") status = 404;
      if (error?.code === "EEXIST") status = 409;
      return send(res, status, {error: status >= 500 ? "internal_error" : error.message});
    }
  });
}

export function listenTrainingControlService({
  root,
  token,
  host = "127.0.0.1",
  port = 38910,
}) {
  const server = createTrainingControlService({root, token});
  server.listen(port, host);
  return server;
}
