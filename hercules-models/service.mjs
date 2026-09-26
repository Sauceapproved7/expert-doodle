import http from "node:http";
import {timingSafeEqual} from "node:crypto";
import {HerculesModelRegistry} from "./registry.mjs";
import {HerculesModelRouter} from "./router.mjs";

const MAX_BODY_BYTES = 256 * 1024;

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

export function createModelPlaneService({
  models,
  token,
  nativeOnly = true,
  embeddedRuntimes = {},
  candidates = [],
  candidateRuntimes = {},
  candidateEvaluationEnabled = false,
}) {
  if (!Array.isArray(models)) throw new TypeError("models array is required");
  if (typeof token !== "string" || token.length < 16) {
    throw new TypeError("control token must be at least 16 characters");
  }
  if (!embeddedRuntimes || typeof embeddedRuntimes !== "object") {
    throw new TypeError("embeddedRuntimes must be an object");
  }
  if (!Array.isArray(candidates)) throw new TypeError("candidates must be an array");
  if (!candidateRuntimes || typeof candidateRuntimes !== "object") {
    throw new TypeError("candidateRuntimes must be an object");
  }
  if (typeof candidateEvaluationEnabled !== "boolean") {
    throw new TypeError("candidateEvaluationEnabled must be boolean");
  }

  const registry = new HerculesModelRegistry(models);
  const candidateRegistry = new HerculesModelRegistry(candidates);
  const router = new HerculesModelRouter(registry, {nativeOnly});

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://model-plane.local");

      if (req.method === "GET" && url.pathname === "/health") {
        const all = registry.list();
        return send(res, 200, {
          ok: true,
          service: "hercules-model-plane",
          version: "0.1",
          nativeOnly,
          models: all.length,
          active: all.filter((model) => model.state === "active").length,
          embeddedRuntimes: Object.keys(embeddedRuntimes).length,
          candidates: candidateRegistry.list().length,
          candidateEvaluationEnabled,
          candidateRuntimes: Object.keys(candidateRuntimes).length,
        });
      }

      requireToken(req, token);

      if (req.method === "GET" && url.pathname === "/v1/models") {
        return send(res, 200, {models: registry.list()});
      }

      if (req.method === "GET" && url.pathname === "/v1/candidates") {
        return send(res, 200, {candidates: candidateRegistry.list()});
      }

      if (req.method === "POST" && url.pathname === "/v1/candidates/infer") {
        if (!candidateEvaluationEnabled) {
          throw Object.assign(
            new Error("candidate evaluation is disabled"),
            {statusCode: 403},
          );
        }

        const body = await readBody(req);
        if (!body.candidateId) {
          throw Object.assign(new Error("candidateId is required"), {statusCode: 400});
        }

        let candidate;
        try {
          candidate = candidateRegistry.require(body.candidateId);
        } catch {
          throw Object.assign(
            new Error("unknown candidate: " + body.candidateId),
            {statusCode: 404},
          );
        }

        if (candidate.state !== "candidate") {
          throw Object.assign(
            new Error("candidate registry entry is not in candidate state"),
            {statusCode: 409},
          );
        }

        const task = body.task ?? candidate.tasks[0];
        if (!candidate.tasks.includes(task)) {
          throw Object.assign(
            new Error("candidate does not support task: " + task),
            {statusCode: 400},
          );
        }

        const runtime = candidateRuntimes[candidate.id];
        if (!runtime || typeof runtime.infer !== "function") {
          throw Object.assign(
            new Error("candidate runtime is not loaded: " + candidate.id),
            {statusCode: 503},
          );
        }

        const output = await runtime.infer(body.input, {task, candidate});
        return send(res, 200, {
          candidate: {
            id: candidate.id,
            family: candidate.family,
            checkpoint: candidate.checkpoint,
            origin: candidate.origin,
            state: candidate.state,
          },
          output,
        });
      }

      if (req.method === "POST" && url.pathname === "/v1/route") {
        const body = await readBody(req);
        const model = router.route({
          task: body.task,
          mode: body.mode ?? "production",
          modelId: body.modelId ?? null,
        });
        return send(res, 200, {model});
      }

      if (req.method === "POST" && url.pathname === "/v1/infer") {
        const body = await readBody(req);
        const model = router.route({
          task: body.task,
          mode: body.mode ?? "production",
          modelId: body.modelId ?? null,
        });

        if (model.runtime?.kind !== "embedded") {
          throw Object.assign(new Error("selected model is not an embedded runtime"), {statusCode: 501});
        }

        const runtime = embeddedRuntimes[model.id];
        if (!runtime || typeof runtime.infer !== "function") {
          throw Object.assign(new Error("embedded runtime is not loaded: " + model.id), {statusCode: 503});
        }

        const output = await runtime.infer(body.input, {task: body.task, model});
        return send(res, 200, {
          model: {
            id: model.id,
            checkpoint: model.checkpoint,
            origin: model.origin,
          },
          output,
        });
      }

      return send(res, 404, {error: "not_found"});
    } catch (error) {
      const status = error?.statusCode ?? (
        /no eligible Hercules model/.test(error?.message ?? "") ? 409 : 400
      );
      return send(res, status, {error: status >= 500 ? "internal_error" : error.message});
    }
  });
}

export function listenModelPlaneService({
  models,
  token,
  nativeOnly = true,
  embeddedRuntimes = {},
  candidates = [],
  candidateRuntimes = {},
  candidateEvaluationEnabled = false,
  host = "127.0.0.1",
  port = 38900,
}) {
  const server = createModelPlaneService({
    models,
    token,
    nativeOnly,
    embeddedRuntimes,
    candidates,
    candidateRuntimes,
    candidateEvaluationEnabled,
  });
  server.listen(port, host);
  return server;
}
