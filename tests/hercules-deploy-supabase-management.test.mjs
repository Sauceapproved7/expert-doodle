import test from "node:test";
import assert from "node:assert/strict";
import {
  SupabaseManagementEdgeClient,
  createSupabaseManagementTargetAdapter,
} from "../hercules-deploy/supabase-management.mjs";
import {buildHerculesDeployAdapters} from "../hercules-deploy/service.mjs";

const fixture = {
  projectRef: "xbwuablxhhwsaoomsoco",
  slug: "hercules-revenue-rescue",
  files: [
    {name: "index.ts", content: "Deno.serve(() => new Response('ok'));"},
    {name: "core.ts", content: "export const ok = true;"},
  ],
  entrypointPath: "index.ts",
  verifyJwt: true,
};

test("Supabase Management client deploys multipart source without leaking its credential", async () => {
  const calls = [];
  const token = "supabase-management-token-for-tests";
  const client = new SupabaseManagementEdgeClient({
    accessToken: token,
    fetchImpl: async (url, options) => {
      calls.push({url: String(url), options});
      return new Response(JSON.stringify({
        slug: fixture.slug,
        status: "ACTIVE",
        version: 4,
        verify_jwt: true,
        entrypoint_path: "index.ts",
      }), {status: 201, headers: {"content-type": "application/json"}});
    },
  });

  const deployed = await client.deployFunction(fixture);
  assert.equal(deployed.status, "ACTIVE");
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://api.supabase.com/v1/projects/xbwuablxhhwsaoomsoco/functions/deploy?slug=hercules-revenue-rescue",
  );
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.authorization, "Bearer " + token);
  assert.equal(calls[0].options.body instanceof FormData, true);
  assert.equal("content-type" in calls[0].options.headers, false);
  assert.equal(calls[0].url.includes(token), false);
});

test("Supabase Management client returns null for a missing function and deletes by slug", async () => {
  const calls = [];
  const client = new SupabaseManagementEdgeClient({
    accessToken: "supabase-management-token-for-tests",
    fetchImpl: async (url, options) => {
      calls.push({url: String(url), options});
      if ((options.method ?? "GET") === "GET") return new Response("", {status: 404});
      return new Response("", {status: 200});
    },
  });

  assert.equal(await client.getFunction({projectRef: fixture.projectRef, slug: fixture.slug}), null);
  const deleted = await client.deleteFunction({projectRef: fixture.projectRef, slug: fixture.slug});
  assert.deepEqual(deleted, {});
  assert.equal(calls[1].options.method, "DELETE");
});

test("Management-backed target adapter plugs into the existing Hercules target contract", async () => {
  const adapter = createSupabaseManagementTargetAdapter({
    accessToken: "supabase-management-token-for-tests",
    fetchImpl: async (_url, options) => {
      if ((options.method ?? "GET") === "GET") {
        return new Response("", {status: 404});
      }
      return new Response(JSON.stringify({
        slug: fixture.slug,
        status: "ACTIVE",
        version: 1,
        verify_jwt: true,
        entrypoint_path: "index.ts",
      }), {status: 201, headers: {"content-type": "application/json"}});
    },
  });
  assert.equal(typeof adapter.deploy, "function");
  assert.equal(typeof adapter.verify, "function");
  assert.equal(typeof adapter.rollback, "function");
});

test("Deploy service registers Supabase target only when a runtime credential is configured", () => {
  const absent = buildHerculesDeployAdapters({env: {}, adapters: new Map()});
  assert.equal(absent.has("supabase_edge_function"), false);

  const configured = buildHerculesDeployAdapters({
    env: {HERCULES_SUPABASE_MANAGEMENT_TOKEN: "supabase-management-token-for-tests"},
    adapters: new Map(),
    fetchImpl: async () => new Response("", {status: 500}),
  });
  assert.equal(configured.has("supabase_edge_function"), true);

  const explicit = {name: "explicit"};
  const preserved = buildHerculesDeployAdapters({
    env: {HERCULES_SUPABASE_MANAGEMENT_TOKEN: "supabase-management-token-for-tests"},
    adapters: new Map([["supabase_edge_function", explicit]]),
  });
  assert.equal(preserved.get("supabase_edge_function"), explicit);
});
