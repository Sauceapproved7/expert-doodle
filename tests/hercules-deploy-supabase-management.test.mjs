import test from "node:test";
import assert from "node:assert/strict";
import {
  SupabaseManagementEdgeFunctionClient,
  createSupabaseEdgeFunctionAdapterFromEnv,
} from "../hercules-deploy/supabase-management.mjs";
import {createHerculesDeployAdaptersFromEnv} from "../hercules-deploy/service.mjs";

const projectRef = "abcdefghijklmnopqrst";
const slug = "hercules-revenue-rescue";

function multipartFunctionBody() {
  const form = new FormData();
  form.append("metadata", JSON.stringify({
    entrypoint_path: `supabase/functions/${slug}/index.ts`,
    verify_jwt: true,
  }));
  form.append("file", new Blob(['Deno.serve(() => new Response("ok"));']), `supabase/functions/${slug}/index.ts`);
  form.append("file", new Blob(["export const version = 1;"]), `supabase/functions/${slug}/core.ts`);
  return new Response(form, {status: 200});
}

test("management client deploys and downloads raw Edge Function source without leaking credentials", async () => {
  const token = "sbp_fc_test_token_for_hercules_deploy_123456";
  const calls = [];
  const client = new SupabaseManagementEdgeFunctionClient({
    accessToken: token,
    allowedProjectRefs: [projectRef],
    fetchImpl: async (url, options = {}) => {
      calls.push({url: String(url), options});
      const parsed = new URL(String(url));
      if (options.method === "POST" && parsed.pathname.endsWith("/functions/deploy")) {
        assert.equal(options.headers.authorization, "Bearer " + token);
        assert.equal(String(url).includes(token), false);
        assert.ok(options.body instanceof FormData);
        const metadata = JSON.parse(String(options.body.get("metadata")));
        assert.equal(metadata.entrypoint_path, `supabase/functions/${slug}/index.ts`);
        assert.equal(metadata.verify_jwt, true);
        assert.equal(options.body.getAll("file").length, 2);
        return Response.json({
          id: "fn-1",
          slug,
          name: slug,
          status: "ACTIVE",
          version: 9,
          verify_jwt: true,
          entrypoint_path: metadata.entrypoint_path,
        }, {status: 201});
      }
      if (options.method === "DELETE") {
        return Response.json({ok: true}, {status: 200});
      }
      if (parsed.pathname.endsWith("/body")) {
        assert.equal(options.headers.accept, "multipart/form-data");
        return multipartFunctionBody();
      }
      return Response.json({
        id: "fn-1",
        slug,
        name: slug,
        status: "ACTIVE",
        version: 8,
        verify_jwt: true,
        entrypoint_path: `supabase/functions/${slug}/index.ts`,
      });
    },
  });

  const current = await client.getFunction({projectRef, slug});
  assert.equal(current.status, "ACTIVE");
  assert.equal(current.entrypoint_path, "index.ts");
  assert.deepEqual(current.files.map((file) => file.name), ["core.ts", "index.ts"]);

  const deployed = await client.deployFunction({
    projectRef,
    slug,
    entrypointPath: "index.ts",
    verifyJwt: true,
    files: [
      {name: "index.ts", content: 'Deno.serve(() => new Response("ok"));'},
      {name: "core.ts", content: "export const version = 1;"},
    ],
  });
  assert.equal(deployed.version, 9);

  await client.deleteFunction({projectRef, slug});
  assert.equal(calls.some((call) => call.options.method === "DELETE"), true);
});

test("management client fails closed outside its project allowlist", async () => {
  const client = new SupabaseManagementEdgeFunctionClient({
    accessToken: "sbp_fc_test_token_for_hercules_deploy_123456",
    allowedProjectRefs: [projectRef],
    fetchImpl: async () => {
      throw new Error("network should not be called");
    },
  });
  await assert.rejects(
    client.getFunction({projectRef: "zzzzzzzzzzzzzzzzzzzz", slug}),
    /project ref is not allowed/,
  );
});

test("adapter auto-wiring is disabled without a credential and enabled only with an allowlist", () => {
  assert.equal(createSupabaseEdgeFunctionAdapterFromEnv({}), null);
  assert.throws(
    () => createSupabaseEdgeFunctionAdapterFromEnv({
      HERCULES_SUPABASE_ACCESS_TOKEN: "sbp_fc_test_token_for_hercules_deploy_123456",
    }),
    /HERCULES_SUPABASE_PROJECT_REFS is required/,
  );
  const adapter = createSupabaseEdgeFunctionAdapterFromEnv({
    HERCULES_SUPABASE_ACCESS_TOKEN: "sbp_fc_test_token_for_hercules_deploy_123456",
    HERCULES_SUPABASE_PROJECT_REFS: projectRef,
  }, {fetchImpl: async () => Response.json({})});
  assert.ok(adapter);
  assert.equal(typeof adapter.deploy, "function");
  assert.equal(typeof adapter.verify, "function");
  assert.equal(typeof adapter.rollback, "function");

  const adapters = createHerculesDeployAdaptersFromEnv({
    HERCULES_SUPABASE_ACCESS_TOKEN: "sbp_fc_test_token_for_hercules_deploy_123456",
    HERCULES_SUPABASE_PROJECT_REFS: projectRef,
  }, {fetchImpl: async () => Response.json({})});
  assert.equal(adapters.has("supabase_edge_function"), true);
});


test("management client constructor and target validation fail closed", async () => {
  assert.throws(
    () => new SupabaseManagementEdgeFunctionClient({
      accessToken: "short",
      allowedProjectRefs: [projectRef],
      fetchImpl: async () => Response.json({}),
    }),
    /access token is invalid/,
  );
  assert.throws(
    () => new SupabaseManagementEdgeFunctionClient({
      accessToken: "sbp_fc_test_token_for_hercules_deploy_123456",
      allowedProjectRefs: [],
      fetchImpl: async () => Response.json({}),
    }),
    /at least one Supabase project ref is required/,
  );
  assert.throws(
    () => new SupabaseManagementEdgeFunctionClient({
      accessToken: "sbp_fc_test_token_for_hercules_deploy_123456",
      allowedProjectRefs: ["bad-ref"],
      fetchImpl: async () => Response.json({}),
    }),
    /project ref is invalid/,
  );
  assert.throws(
    () => new SupabaseManagementEdgeFunctionClient({
      accessToken: "sbp_fc_test_token_for_hercules_deploy_123456",
      allowedProjectRefs: [projectRef],
      baseUrl: "http://api.supabase.com",
      fetchImpl: async () => Response.json({}),
    }),
    /credential-free HTTPS URL/,
  );

  const client = new SupabaseManagementEdgeFunctionClient({
    accessToken: "sbp_fc_test_token_for_hercules_deploy_123456",
    allowedProjectRefs: [projectRef],
    fetchImpl: async () => Response.json({}),
  });
  await assert.rejects(
    client.getFunction({projectRef: "bad", slug}),
    /project ref is invalid/,
  );
  await assert.rejects(
    client.getFunction({projectRef, slug: "../bad"}),
    /slug is invalid/,
  );
});

test("management client reports provider read failures without mutating anything", async () => {
  const token = "sbp_fc_test_token_for_hercules_deploy_123456";
  let mode = "metadata-500";
  const client = new SupabaseManagementEdgeFunctionClient({
    accessToken: token,
    allowedProjectRefs: [projectRef],
    fetchImpl: async (url) => {
      const path = new URL(String(url)).pathname;
      if (mode === "metadata-404") return new Response("", {status: 404});
      if (mode === "metadata-500") return new Response("nope", {status: 500});
      if (path.endsWith("/body")) {
        if (mode === "body-500") return new Response("nope", {status: 500});
        if (mode === "bad-body-metadata") {
          const form = new FormData();
          form.append("metadata", "{");
          form.append("file", new Blob(["x"]), `supabase/functions/${slug}/index.ts`);
          return new Response(form, {status: 200});
        }
        if (mode === "no-files") {
          const form = new FormData();
          form.append("metadata", JSON.stringify({entrypoint_path: `supabase/functions/${slug}/index.ts`}));
          return new Response(form, {status: 200});
        }
      }
      return Response.json({slug, status: "ACTIVE", verify_jwt: true});
    },
  });

  await assert.rejects(client.getFunction({projectRef, slug}), /metadata request failed/);
  mode = "metadata-404";
  assert.equal(await client.getFunction({projectRef, slug}), null);
  mode = "body-500";
  await assert.rejects(client.getFunction({projectRef, slug}), /source download failed/);
  mode = "bad-body-metadata";
  await assert.rejects(client.getFunction({projectRef, slug}), /source metadata was invalid JSON/);
  mode = "no-files";
  await assert.rejects(client.getFunction({projectRef, slug}), /returned no files/);
});

test("management client validates deploy bundles and provider write statuses", async () => {
  let status = 500;
  const client = new SupabaseManagementEdgeFunctionClient({
    accessToken: "sbp_fc_test_token_for_hercules_deploy_123456",
    allowedProjectRefs: [projectRef],
    fetchImpl: async (_url, options = {}) => {
      if (options.method === "DELETE") return new Response("", {status});
      return new Response("{}", {status});
    },
  });

  await assert.rejects(
    client.deployFunction({projectRef, slug, files: []}),
    /files are required/,
  );
  await assert.rejects(
    client.deployFunction({
      projectRef,
      slug,
      entrypointPath: "index.ts",
      files: [{name: "../outside.ts", content: "x"}],
    }),
    /outside the function root/,
  );
  await assert.rejects(
    client.deployFunction({
      projectRef,
      slug,
      entrypointPath: "index.ts",
      files: [
        {name: "index.ts", content: "a"},
        {name: "index.ts", content: "b"},
      ],
    }),
    /file names must be unique/,
  );
  await assert.rejects(
    client.deployFunction({
      projectRef,
      slug,
      entrypointPath: "index.ts",
      files: [{name: "core.ts", content: "x"}],
    }),
    /entrypoint is missing/,
  );
  await assert.rejects(
    client.deployFunction({
      projectRef,
      slug,
      files: [{name: "index.ts", content: "x"}],
    }),
    /deploy failed with status 500/,
  );
  await assert.rejects(client.deleteFunction({projectRef, slug}), /delete failed with status 500/);
  status = 404;
  assert.deepEqual(await client.deleteFunction({projectRef, slug}), {deleted: false});
});
