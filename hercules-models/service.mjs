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
}) {
  if (!Array.isArray(models)) throw new TypeError("models array is required");
  if (typeof token !== "string" || token.length < 16) {
    throw new TypeError("control token must be at least 16 characters");
  }

  const registry = new HerculesModelRegistry(models);
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
        });
      }

      requireToken(req, token);

      if (req.method === "GET" && url.pathname === "/v1/models") {
        return send(res, 200, {models: registry.list()});
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
  host = "127.0.0.1",
  port = 38900,
}) {
  const server = createModelPlaneService({models, token, nativeOnly});
  server.listen(port, host);
  return server;
}
