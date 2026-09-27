import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {createAuthorityLease} from "../hercules-authority/authority-lease.mjs";
import {
  createDomainAgentIdentity,
  createProviderGrantRecord,
} from "../hercules-authority/domain-agent.mjs";
import {createDomainAgentService} from "../hercules-authority/domain-agent-service.mjs";
import {createHerculesRouteTask} from "../hercules-authority/domain-agent-router.mjs";

const TOKEN = "0123456789abcdef0123456789abcdef";
const SHA = "b".repeat(64);

function fixture() {
  const identity = createDomainAgentIdentity({
    domain: "agent.sauceapproved.com",
    tenantId: "sauceapproved",
    agentId: "hercules-domain-agent",
  });
  const grant = createProviderGrantRecord({
    tenantId: "sauceapproved",
    provider: "github",
    connectionRef: "github-connection-primary",
    authorizationEvidenceSha256: SHA,
    scopes: ["repo.write"],
    status: "active",
    refreshable: true,
    authorizedAt: "2026-09-27T16:00:00Z",
    expiresAt: "2026-09-27T20:00:00Z",
  });
  const authorityLease = createAuthorityLease({
    subject: {type: "domain-agent", id: "hercules-domain-agent"},
    intent: {id: "task-1"},
    authorization: {evidenceSha256: SHA},
    scope: {
      resources: ["github:repo:Sauceapproved7/expert-doodle"],
      actions: ["repository.update"],
      maxImpact: "RESOURCE",
    },
    validFrom: "2026-09-27T17:00:00Z",
    expiresAt: "2026-09-27T19:00:00Z",
  });
  const task = {
    id: "task-1",
    tenantId: "sauceapproved",
    provider: "github",
    requiredScopes: ["repo.write"],
    resource: "github:repo:Sauceapproved7/expert-doodle",
    action: "repository.update",
    impact: "RESOURCE",
    at: "2026-09-27T18:00:00Z",
    authorityLease,
    input: {text: "Update repository documentation"},
  };
  return {identity, grant, task};
}

async function start(options = {}) {
  const base = fixture();
  const executions = [];
  const service = createDomainAgentService({
    identity: base.identity,
    controlToken: TOKEN,
    resolveProviderGrant: async () => base.grant,
    refreshProviderGrant: async (value) => value,
    routeTask: async () => ({route: "coding", modelId: "hercules-agent"}),
    executeProviderTask: async (ctx) => {
      executions.push(ctx);
      return {ok: true, providerRequestId: "provider-1"};
    },
    ...options,
  });
  service.listen(0, "127.0.0.1");
  await once(service, "listening");
  const {port} = service.address();
  return {...base, service, executions, baseUrl: `http://127.0.0.1:${port}`};
}

test("public health and discovery surfaces expose no credentials", async (t) => {
  const state = await start();
  t.after(() => state.service.close());

  const health = await fetch(state.baseUrl + "/health").then((r) => r.json());
  assert.equal(health.ok, true);
  assert.equal(health.service, "hercules-domain-agent");

  const discovery = await fetch(state.baseUrl + "/.well-known/hercules-agent.json").then((r) => r.json());
  assert.equal(discovery.agent.origin, "https://agent.sauceapproved.com");
  assert.equal(JSON.stringify(discovery).includes("github-connection-primary"), false);
});

test("task execution requires control authentication and idempotency", async (t) => {
  const state = await start();
  t.after(() => state.service.close());

  const noAuth = await fetch(state.baseUrl + "/v1/tasks", {
    method: "POST",
    headers: {"content-type": "application/json", "idempotency-key": "task-1"},
    body: JSON.stringify(state.task),
  });
  assert.equal(noAuth.status, 401);

  const noIdempotency = await fetch(state.baseUrl + "/v1/tasks", {
    method: "POST",
    headers: {"content-type": "application/json", authorization: "Bearer " + TOKEN},
    body: JSON.stringify(state.task),
  });
  assert.equal(noIdempotency.status, 400);
});

test("authorized tasks route through Hercules and execute through a credential-isolated adapter", async (t) => {
  const state = await start();
  t.after(() => state.service.close());

  const response = await fetch(state.baseUrl + "/v1/tasks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + TOKEN,
      "idempotency-key": "task-1",
    },
    body: JSON.stringify(state.task),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "executed");
  assert.equal(body.route.route, "coding");
  assert.equal(state.executions.length, 1);
  assert.equal(state.executions[0].connectionRef, "github-connection-primary");
  assert.equal("accessToken" in state.executions[0], false);
  assert.equal("credentials" in state.executions[0], false);
});

test("same idempotency key returns the recorded result without a second provider action", async (t) => {
  const state = await start();
  t.after(() => state.service.close());

  const request = () => fetch(state.baseUrl + "/v1/tasks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + TOKEN,
      "idempotency-key": "same-operation",
    },
    body: JSON.stringify(state.task),
  }).then((r) => r.json());

  const first = await request();
  const second = await request();
  assert.deepEqual(second, first);
  assert.equal(state.executions.length, 1);
});

test("refreshable provider grants refresh automatically before execution", async (t) => {
  const base = fixture();
  let refreshes = 0;
  const expired = createProviderGrantRecord({...base.grant, expiresAt: "2026-09-27T17:59:59Z"});
  const active = createProviderGrantRecord({...base.grant, expiresAt: "2026-09-27T20:00:00Z"});
  const state = await start({
    resolveProviderGrant: async () => expired,
    refreshProviderGrant: async () => {
      refreshes += 1;
      return active;
    },
  });
  t.after(() => state.service.close());

  const response = await fetch(state.baseUrl + "/v1/tasks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + TOKEN,
      "idempotency-key": "refresh-operation",
    },
    body: JSON.stringify(state.task),
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, "executed");
  assert.equal(refreshes, 1);
});

test("owner-only boundaries stop before routing or provider execution", async (t) => {
  let routed = 0;
  let executed = 0;
  const state = await start({
    routeTask: async () => { routed += 1; return {route: "coding"}; },
    executeProviderTask: async () => { executed += 1; return {ok: true}; },
  });
  t.after(() => state.service.close());

  const response = await fetch(state.baseUrl + "/v1/tasks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + TOKEN,
      "idempotency-key": "owner-boundary",
    },
    body: JSON.stringify({...state.task, ownerBoundary: "required_permission_grants"}),
  });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.status, "owner_action_required");
  assert.equal(routed, 0);
  assert.equal(executed, 0);
});

test("reusing an idempotency key for a different operation is rejected", async (t) => {
  const state = await start();
  t.after(() => state.service.close());

  const headers = {
    "content-type": "application/json",
    authorization: "Bearer " + TOKEN,
    "idempotency-key": "conflict-key",
  };
  const first = await fetch(state.baseUrl + "/v1/tasks", {
    method: "POST",
    headers,
    body: JSON.stringify(state.task),
  });
  assert.equal(first.status, 200);

  const second = await fetch(state.baseUrl + "/v1/tasks", {
    method: "POST",
    headers,
    body: JSON.stringify({...state.task, input: {text: "Different operation"}}),
  });
  assert.equal(second.status, 409);
  assert.equal(state.executions.length, 1);
});

test("oversized task bodies are rejected before routing or provider execution", async (t) => {
  let executed = 0;
  const state = await start({
    executeProviderTask: async () => { executed += 1; return {ok: true}; },
  });
  t.after(() => state.service.close());

  const response = await fetch(state.baseUrl + "/v1/tasks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + TOKEN,
      "idempotency-key": "oversized",
    },
    body: JSON.stringify({...state.task, input: {text: "x".repeat(300000)}}),
  });
  assert.equal(response.status, 413);
  assert.equal(executed, 0);
});

test("Hercules route adapter converts domain-agent task input into owned router inference", async () => {
  const calls = [];
  const routeTask = createHerculesRouteTask({
    router: {
      infer(input) {
        calls.push(input);
        return {modelId: "hercules-agent", route: "coding", scores: {coding: 0.9}};
      },
    },
  });
  const routed = await routeTask({
    requestId: "task-1",
    input: {text: "Build the production connector"},
    provider: "github",
    action: "repository.update",
    resource: "repo",
  });
  assert.equal(routed.modelId, "hercules-agent");
  assert.equal(routed.route, "coding");
  assert.equal(calls[0], "Build the production connector");
});

test("Hercules route adapter refuses an invalid router runtime", () => {
  assert.throws(() => createHerculesRouteTask({router: {}}), /infer/i);
});
