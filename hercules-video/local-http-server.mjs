import http from "node:http";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}

async function readJson(req, maxBodyBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw Object.assign(new Error("request_body_too_large"), {statusCode: 413});
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("invalid_json"), {statusCode: 400});
  }
}

export function createHerculesVideoHttpServer({
  runtime,
  host = "127.0.0.1",
  port = 8090,
  maxBodyBytes = 1024 * 1024,
} = {}) {
  if (!runtime) throw new Error("http_runtime_required");
  if (!LOOPBACK_HOSTS.has(host)) throw new Error("http_loopback_host_required");
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("http_port_invalid");
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes <= 0) throw new Error("http_body_limit_invalid");

  const target = {kind:"self-hosted", runtimeId:runtime.runtimeId, endpoint:`http://${host}:${port}`};

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${host}`);

      if (req.method === "GET" && url.pathname === "/health") {
        return json(res, 200, await runtime.health({target}));
      }

      if (req.method === "POST" && url.pathname === "/v1/render") {
        const request = await readJson(req, maxBodyBytes);
        const result = await runtime.submit({target, request});
        return json(res, 202, result);
      }

      const match = url.pathname.match(/^\/v1\/jobs\/([a-f0-9]{32})$/);
      if (req.method === "GET" && match) {
        return json(res, 200, await runtime.status({target, remoteJobId:match[1]}));
      }

      return json(res, 404, {error:"not_found"});
    } catch (error) {
      const statusCode = Number(error?.statusCode || (String(error?.message).includes("not_found") ? 404 : 400));
      return json(res, statusCode, {error:String(error?.message || "request_failed")});
    }
  });

  return {
    server,
    host,
    port,
    async listen() {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, resolve);
      });
      const address = server.address();
      return {
        host,
        port: typeof address === "object" && address ? address.port : port,
      };
    },
    async close() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}
