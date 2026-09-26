import http from "node:http";
import {timingSafeEqual} from "node:crypto";
import {HerculesDeployStore} from "./store.mjs";
import {HerculesDeployWorker} from "./worker.mjs";

const MAX_BODY_BYTES = 256 * 1024;

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
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
    throw Object.assign(new Error("invalid JSON body"), {statusCode: 400});
  }
}

function requireToken(req, expectedToken) {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) {
    throw Object.assign(new Error("unauthorized"), {statusCode: 401});
  }
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(expectedToken);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw Object.assign(new Error("unauthorized"), {statusCode: 401});
  }
}

function parts(url) {
  try {
    return url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch (error) {
    if (error instanceof URIError) {
      throw Object.assign(new Error("malformed path encoding"), {statusCode: 400});
    }
    throw error;
  }
}

function errorStatus(error) {
  if (Number.isInteger(error?.statusCode)) return error.statusCode;
  if (error?.code === "ENOENT") return 404;
  if (error?.code === "EEXIST") return 409;
  if (error instanceof TypeError) return 400;
  return 500;
}

export function createHerculesDeployService({
  root,
  token,
  adapters = new Map(),
  pollIntervalMs = 1000,
  autoStartWorker = true,
} = {}) {
  if (!root) throw new TypeError("root is required");
  if (typeof token !== "string" || token.length < 16) {
    throw new TypeError("control token must be at least 16 characters");
  }

  const store = new HerculesDeployStore(root);
  const worker = new HerculesDeployWorker({store, adapters, pollIntervalMs});

  const server = http.createServer(async (req, res) => {
    res.setHeader("referrer-policy", "no-referrer");
    res.setHeader("x-frame-options", "DENY");
    try {
      const url = new URL(req.url, "http://localhost");
      const route = parts(url);

      if (req.method === "GET" && url.pathname === "/health") {
        return send(res, 200, {
          ok: true,
          service: "hercules-deploy-plane",
          version: "0.1",
          worker: true,
          workerRunning: !worker.stopped,
          adapterKinds: [...adapters.keys()].sort(),
        });
      }

      if (req.method === "GET" && url.pathname === "/ready") {
        return send(res, worker.stopped ? 503 : 200, {
          ready: !worker.stopped,
          service: "hercules-deploy-plane",
          version: "0.1",
          workerRunning: !worker.stopped,
        });
      }

      requireToken(req, token);

      if (req.method === "POST" && url.pathname === "/v1/deployments") {
        const body = await readBody(req);
        const created = await store.create(body.request ?? body, {
          deploymentId: body.deploymentId,
        });
        return send(res, 201, created);
      }

      if (req.method === "GET" && url.pathname === "/v1/deployments") {
        const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : 100;
        const status = url.searchParams.get("status");
        return send(res, 200, {
          deployments: await store.list({limit, status}),
        });
      }

      if (route[0] === "v1" && route[1] === "deployments" && route[2]) {
        const deploymentId = route[2];

        if (req.method === "GET" && route.length === 3) {
          return send(res, 200, await store.get(deploymentId));
        }

        if (req.method === "POST" && route[3] === "retry" && route.length === 4) {
          return send(res, 200, await worker.retry(deploymentId));
        }

        if (req.method === "POST" && route[3] === "rollback" && route.length === 4) {
          return send(res, 200, await worker.rollback(deploymentId));
        }
      }

      if (req.method === "POST" && url.pathname === "/v1/worker/run-once") {
        const deployment = await worker.runOnce();
        return send(res, 200, {deployment});
      }

      return send(res, 404, {error: "not_found"});
    } catch (error) {
      const status = errorStatus(error);
      const headers = status === 429 && error?.retryAfterSeconds
        ? {"retry-after": String(error.retryAfterSeconds)}
        : {};
      res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        ...headers,
      });
      res.end(JSON.stringify({error: status >= 500 ? "internal_error" : error.message}));
    }
  });

  server.on("close", () => worker.stop());
  if (autoStartWorker) worker.start();

  return {server, store, worker};
}

export function listenHerculesDeployService({
  root,
  token,
  adapters = new Map(),
  pollIntervalMs = 1000,
  host = "127.0.0.1",
  port = 38800,
} = {}) {
  const service = createHerculesDeployService({
    root,
    token,
    adapters,
    pollIntervalMs,
    autoStartWorker: true,
  });
  service.server.listen(port, host);
  return service;
}
