import http from "node:http";
import {createHash, timingSafeEqual} from "node:crypto";
import {
  createAgentDiscoveryDocument,
  evaluateDomainAgentTask,
} from "./domain-agent.mjs";

const MAX_BODY_BYTES = 256 * 1024;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

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

function requireIdempotencyKey(req) {
  const value = String(req.headers["idempotency-key"] ?? "").trim();
  if (!value || value.length > 200) {
    throw Object.assign(new Error("valid idempotency-key header required"), {statusCode: 400});
  }
  return value;
}

function statusForDisposition(disposition) {
  if (disposition === "OWNER_ACTION_REQUIRED") return 409;
  if (disposition === "DENY") return 403;
  if (disposition === "REFRESH_REQUIRED") return 503;
  return 200;
}

function sanitizedExecutionContext({identity, grant, task, route, decision}) {
  return Object.freeze({
    agentSubject: identity.subject,
    tenantId: task.tenantId,
    provider: task.provider,
    connectionRef: grant.connectionRef,
    task: {
      id: task.id,
      resource: task.resource,
      action: task.action,
      impact: task.impact,
      input: task.input ?? null,
    },
    route,
    authorityDecisionSha256: decision.decisionSha256,
  });
}

export function createDomainAgentService({
  identity,
  controlToken,
  resolveProviderGrant,
  refreshProviderGrant,
  routeTask,
  executeProviderTask,
  idempotencyStore = new Map(),
}) {
  if (identity?.schema !== "hercules.domain-agent.identity.v1") {
    throw new TypeError("valid Hercules domain agent identity required");
  }
  if (typeof controlToken !== "string" || controlToken.length < 16) {
    throw new TypeError("controlToken must be at least 16 characters");
  }
  for (const [name, fn] of Object.entries({
    resolveProviderGrant,
    refreshProviderGrant,
    routeTask,
    executeProviderTask,
  })) {
    if (typeof fn !== "function") throw new TypeError(name + " function is required");
  }
  if (!idempotencyStore || typeof idempotencyStore.get !== "function" || typeof idempotencyStore.set !== "function") {
    throw new TypeError("idempotencyStore must support get and set");
  }

  const discovery = createAgentDiscoveryDocument(identity);

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://hercules-domain-agent.local");

      if (req.method === "GET" && url.pathname === "/health") {
        return send(res, 200, {
          ok: true,
          service: "hercules-domain-agent",
          schema: "hercules.domain-agent.health.v1",
          agentSubject: identity.subject,
          executionAuthority: false,
        });
      }

      if (req.method === "GET" && url.pathname === "/.well-known/hercules-agent.json") {
        return send(res, 200, discovery);
      }

      if (!(req.method === "POST" && url.pathname === "/v1/tasks")) {
        return send(res, 404, {error: "not_found"});
      }

      requireToken(req, controlToken);
      const idempotencyKey = requireIdempotencyKey(req);
      const task = await readBody(req);
      if (task.tenantId !== identity.tenantId) {
        return send(res, 403, {error: "tenant_mismatch"});
      }

      const requestFingerprint = fingerprint(task);
      const storeKey = identity.tenantId + ":" + idempotencyKey;
      const recorded = await idempotencyStore.get(storeKey);
      if (recorded) {
        if (recorded.requestFingerprint !== requestFingerprint) {
          return send(res, 409, {error: "idempotency_conflict"});
        }
        return send(res, recorded.statusCode, recorded.body);
      }

      let grant = await resolveProviderGrant({
        tenantId: task.tenantId,
        provider: task.provider,
        requiredScopes: task.requiredScopes ?? [],
      });

      let decision = evaluateDomainAgentTask({
        identity,
        providerGrant: grant,
        authorityLease: task.authorityLease,
        request: task,
      });

      if (decision.disposition === "REFRESH_REQUIRED") {
        grant = await refreshProviderGrant(grant, {
          tenantId: task.tenantId,
          provider: task.provider,
          requestId: task.id,
        });
        decision = evaluateDomainAgentTask({
          identity,
          providerGrant: grant,
          authorityLease: task.authorityLease,
          request: task,
        });
      }

      if (!decision.executionEligible) {
        const statusCode = statusForDisposition(decision.disposition);
        const body = {
          status: decision.disposition === "OWNER_ACTION_REQUIRED"
            ? "owner_action_required"
            : decision.disposition.toLowerCase(),
          decision,
        };
        await idempotencyStore.set(storeKey, {requestFingerprint, statusCode, body});
        return send(res, statusCode, body);
      }

      const route = await routeTask({
        tenantId: task.tenantId,
        agentId: identity.agentId,
        requestId: task.id,
        input: task.input ?? null,
        provider: task.provider,
        action: task.action,
        resource: task.resource,
      });

      const execution = await executeProviderTask(
        sanitizedExecutionContext({identity, grant, task, route, decision}),
      );

      const body = {
        status: "executed",
        requestId: task.id,
        route,
        execution,
        decisionSha256: decision.decisionSha256,
      };
      await idempotencyStore.set(storeKey, {requestFingerprint, statusCode: 200, body});
      return send(res, 200, body);
    } catch (error) {
      const status = error?.statusCode ?? 500;
      return send(res, status, {
        error: status >= 500 ? "internal_error" : error.message,
      });
    }
  });
}
