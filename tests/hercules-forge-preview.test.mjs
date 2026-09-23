import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {ForgeWorkspaceStore} from "../hercules-forge/workspace.mjs";
import {buildForgeArtifact} from "../hercules-forge/artifact.mjs";
import {buildPreviewChildEnv, startForgePreview} from "../hercules-forge/preview.mjs";
import {createForgeControlService} from "../hercules-forge/control-api.mjs";

const token = "p".repeat(24);
const spec = {
  version: "0.1",
  name: "PreviewApp",
  description: "Owned preview fixture.",
  entities: [
    {name: "Item", fields: [{name: "name", type: "string", required: true}]},
  ],
  pages: [{name: "Items", kind: "list", entity: "Item"}],
  actions: [{name: "CreateItem", kind: "create", entity: "Item"}],
};

test("preview child environment strips Forge and credential variables", () => {
  const env = buildPreviewChildEnv({
    PATH: "/bin",
    FORGE_CONTROL_TOKEN: "secret",
    FORGE_INTERPRETER_TOKEN: "secret",
    OPENAI_API_KEY: "secret",
    HOME: "/tmp/home",
  });
  assert.equal(env.PATH, "/bin");
  assert.equal(env.HOME, "/tmp/home");
  assert.equal(env.FORGE_CONTROL_TOKEN, undefined);
  assert.equal(env.FORGE_INTERPRETER_TOKEN, undefined);
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.HOST, "127.0.0.1");
  assert.equal(env.PORT, "0");
  const withData = buildPreviewChildEnv({PATH: "/bin"}, {dataDir: "/tmp/forge-data"});
  assert.equal(withData.FORGE_DATA_DIR, "/tmp/forge-data");
});

test("verified artifact starts a loopback preview with proxied CRUD API", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-preview-"));
  let preview;
  try {
    const store = new ForgeWorkspaceStore(root);
    const {revision} = await store.createProject(spec, {projectId: "preview-app"});
    const artifact = await buildForgeArtifact({
      workspaceRoot: root,
      artifactRoot: join(root, "artifacts"),
      projectId: "preview-app",
      revisionId: revision.revisionId,
    });

    const runtimeDataDir = join(root, "runtime-data", "preview-app");
    preview = await startForgePreview({
      artifactDir: artifact.artifactDir,
      runtimeDataDir,
    });
    assert.match(preview.url, /^http:\/\/127\.0\.0\.1:/);
    assert.match(preview.backendUrl, /^http:\/\/127\.0\.0\.1:/);
    assert.equal(preview.isolation, "loopback-controlled-process");

    const page = await fetch(preview.url + "/");
    assert.equal(page.status, 200);
    assert.match(await page.text(), /PreviewApp/);

    const appJs = await fetch(preview.url + "/app.js");
    assert.equal(appJs.status, 200);
    assert.match(appJs.headers.get("content-type"), /javascript/);
    assert.match(await appJs.text(), /Create/);

    const appCss = await fetch(preview.url + "/app.css");
    assert.equal(appCss.status, 200);
    assert.match(appCss.headers.get("content-type"), /text\/css/);

    const health = await fetch(preview.url + "/health");
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);

    const created = await fetch(preview.url + "/api/Item", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({name: "first", id: "attacker-choice"}),
    });
    assert.equal(created.status, 201);
    const item = await created.json();
    assert.equal(item.name, "first");
    assert.notEqual(item.id, "attacker-choice");

    const listed = await fetch(preview.url + "/api/Item");
    assert.equal(listed.status, 200);
    assert.equal((await listed.json()).items.length, 1);

    await preview.stop();
    preview = await startForgePreview({
      artifactDir: artifact.artifactDir,
      runtimeDataDir,
    });
    const persisted = await fetch(preview.url + "/api/Item");
    assert.equal(persisted.status, 200);
    const persistedBody = await persisted.json();
    assert.equal(persistedBody.items.length, 1);
    assert.equal(persistedBody.items[0].name, "first");
  } finally {
    if (preview) await preview.stop();
    await rm(root, {recursive: true, force: true});
  }
});

test("control API starts, reports, and stops an owned preview", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-preview-api-"));
  const server = createForgeControlService({root, token});
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;

  async function request(path, options = {}) {
    const response = await fetch(base + path, {
      method: options.method ?? "GET",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    return {status: response.status, body: await response.json()};
  }

  try {
    const created = await request("/v1/projects", {
      method: "POST",
      body: {spec, metadata: {projectId: "preview-api-app"}},
    });
    assert.equal(created.status, 201);
    const revisionId = created.body.revision.revisionId;

    const started = await request(
      "/v1/projects/preview-api-app/revisions/" + revisionId + "/preview",
      {method: "POST"},
    );
    assert.equal(started.status, 201);
    assert.match(started.body.preview.url, /^http:\/\/127\.0\.0\.1:/);

    const status = await request("/v1/projects/preview-api-app/preview");
    assert.equal(status.status, 200);
    assert.equal(status.body.preview.revisionId, revisionId);

    const page = await fetch(status.body.preview.url);
    assert.equal(page.status, 200);

    const firstItem = await fetch(status.body.preview.url + "/api/Item", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({name: "persists-across-revision"}),
    });
    assert.equal(firstItem.status, 201);

    const stopped = await request("/v1/projects/preview-api-app/preview", {
      method: "DELETE",
    });
    assert.equal(stopped.status, 200);
    assert.equal(stopped.body.stopped, true);

    const nextSpec = structuredClone(spec);
    nextSpec.description = "Owned preview fixture revision two.";
    const revised = await request("/v1/projects/preview-api-app/revisions", {
      method: "POST",
      body: {spec: nextSpec, message: "revision two"},
    });
    assert.equal(revised.status, 201);

    const restarted = await request(
      "/v1/projects/preview-api-app/revisions/" + revised.body.revisionId + "/preview",
      {method: "POST"},
    );
    assert.equal(restarted.status, 201);

    const persisted = await fetch(restarted.body.preview.url + "/api/Item");
    assert.equal(persisted.status, 200);
    const persistedBody = await persisted.json();
    assert.equal(persistedBody.items.length, 1);
    assert.equal(persistedBody.items[0].name, "persists-across-revision");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, {recursive: true, force: true});
  }
});
