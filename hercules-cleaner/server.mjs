import {randomBytes} from "node:crypto";
import http from "node:http";
import {cleanComputer, getCleanerStatus, scanComputer, startWorkSession, stopWorkSession, restoreCapsule, setProfileSchedule} from "./agent.mjs";
import {renderDashboard} from "./dashboard.mjs";

function sendJson(res, status, body) {
  res.writeHead(status, {"content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff"});
  res.end(JSON.stringify(body));
}

async function readJson(req, limit = 16 * 1024) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) throw Object.assign(new Error("request body too large"), {statusCode: 413});
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function originAllowed(req, host, port) {
  const origin = req.headers.origin;
  if (!origin) return true;
  return origin === `http://${host}:${port}` || (host === "127.0.0.1" && origin === `http://localhost:${port}`);
}

export function createCleanerServer({host = "127.0.0.1", port = 4777, token = randomBytes(24).toString("hex"), ...agentOptions} = {}) {
  if (!["127.0.0.1", "::1", "localhost"].includes(host)) throw new Error("Hercules Cleaner dashboard must bind to loopback only");
  const server = http.createServer(async (req, res) => {
    try {
      if (!originAllowed(req, host, port)) return sendJson(res, 403, {error: "cross-origin request blocked"});
      const url = new URL(req.url, `http://${host}:${port}`);
      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "content-security-policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'",
          "x-frame-options": "DENY",
          "x-content-type-options": "nosniff",
          "referrer-policy": "no-referrer",
        });
        return res.end(renderDashboard({token}));
      }
      if (req.headers["x-hercules-token"] !== token) return sendJson(res, 401, {error: "local control token required"});
      if (req.method === "GET" && url.pathname === "/api/status") return sendJson(res, 200, await getCleanerStatus(agentOptions));
      if (req.method !== "POST") return sendJson(res, 404, {error: "not found"});
      const body = await readJson(req);
      if (url.pathname === "/api/scan") return sendJson(res, 200, await scanComputer({...agentOptions, profileId: body.profileId}));
      if (url.pathname === "/api/clean") return sendJson(res, 200, await cleanComputer({...agentOptions, profileId: body.profileId}));
      if (url.pathname === "/api/session/start") return sendJson(res, 200, await startWorkSession({...agentOptions, profileId: body.profileId, label: body.label}));
      if (url.pathname === "/api/session/stop") return sendJson(res, 200, await stopWorkSession({...agentOptions, sessionId: body.sessionId, apply: true}));
      if (url.pathname === "/api/restore") return sendJson(res, 200, await restoreCapsule({...agentOptions, capsuleId: body.capsuleId}));
      if (url.pathname === "/api/schedule") return sendJson(res, 200, await setProfileSchedule({...agentOptions, profileId: body.profileId, schedule: body.schedule}));
      return sendJson(res, 404, {error: "not found"});
    } catch (error) {
      sendJson(res, error?.statusCode || 500, {error: error instanceof Error ? error.message : String(error)});
    }
  });
  return {server, token, host, port};
}

export async function listenCleanerServer(options = {}) {
  const instance = createCleanerServer(options);
  await new Promise((resolve, reject) => {
    instance.server.once("error", reject);
    instance.server.listen(instance.port, instance.host, resolve);
  });
  return instance;
}
