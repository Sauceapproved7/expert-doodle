import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createForgeControlService} from "../hercules-forge/control-api.mjs";

const token = "forge-control-test-token-123";

const spec = {
  version: "0.1",
  name: "ControlApp",
  description: "Forge control API fixture.",
  entities: [
    {name: "Note", fields: [{name: "body", type: "string", required: true}]},
  ],
  pages: [{name: "Notes", kind: "list", entity: "Note"}],
  actions: [{name: "CreateNote", kind: "create", entity: "Note"}],
};

async function start(root) {
  const server = createForgeControlService({root, token});
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    server,
    base: "http://127.0.0.1:" + address.port,
  };
}

async function request(base, path, options = {}) {
  const headers = {
    "content-type": "application/json",
    ...(options.authorized === false ? {} : {authorization: "Bearer " + token}),
  };
  const response = await fetch(base + path, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = await response.json();
  return {status: response.status, body};
}

test("control API owns create, inspect, revise, artifact, publish, active release, and rollback flow", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-control-"));
  const {server, base} = await start(root);

  try {
    const health = await request(base, "/health", {authorized: false});
    assert.equal(health.status, 200);
    assert.equal(health.body.ok, true);

    const denied = await request(base, "/v1/projects", {
      method: "POST",
      authorized: false,
      body: {spec},
    });
    assert.equal(denied.status, 401);

    const wrongToken = await fetch(base + "/v1/projects", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer wrong-token-value",
      },
      body: JSON.stringify({spec}),
    });
    assert.equal(wrongToken.status, 401);

    const created = await request(base, "/v1/projects", {
      method: "POST",
      body: {spec, metadata: {projectId: "control-app"}},
    });
    assert.equal(created.status, 201);
    const firstRevisionId = created.body.revision.revisionId;

    const inspected = await request(
      base,
      "/v1/projects/control-app/revisions/" + firstRevisionId,
    );
    assert.equal(inspected.status, 200);
    assert.equal(inspected.body.revisionId, firstRevisionId);

    const built = await request(
      base,
      "/v1/projects/control-app/revisions/" + firstRevisionId + "/artifact",
      {method: "POST"},
    );
    assert.equal(built.status, 201);
    assert.equal(built.body.artifact.revisionId, firstRevisionId);
    assert.match(built.body.artifact.artifactFingerprint, /^[a-f0-9]{64}$/);

    const nextSpec = structuredClone(spec);
    nextSpec.description = "Forge control API fixture v2.";
    const revised = await request(base, "/v1/projects/control-app/revisions", {
      method: "POST",
      body: {spec: nextSpec, message: "v2"},
    });
    assert.equal(revised.status, 201);

    const published = await request(base, "/v1/projects/control-app/publish", {
      method: "POST",
      body: {revisionId: revised.body.revisionId},
    });
    assert.equal(published.status, 201);
    assert.equal(published.body.release.verified, true);
    assert.equal(published.body.release.revisionId, revised.body.revisionId);

    const active = await request(base, "/v1/projects/control-app/releases/active");
    assert.equal(active.status, 200);
    assert.equal(active.body.revisionId, revised.body.revisionId);

    const firstPublish = await request(base, "/v1/projects/control-app/publish", {
      method: "POST",
      body: {revisionId: firstRevisionId},
    });
    assert.equal(firstPublish.status, 201);

    const rollback = await request(base, "/v1/projects/control-app/rollback", {
      method: "POST",
      body: {revisionId: revised.body.revisionId},
    });
    assert.equal(rollback.status, 200);
    assert.equal(rollback.body.rollback, true);
    assert.equal(rollback.body.revisionId, revised.body.revisionId);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, {recursive: true, force: true});
  }
});

test("workspace rejects path-unsafe project identifiers", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-control-id-"));
  const {server, base} = await start(root);

  try {
    const result = await request(base, "/v1/projects", {
      method: "POST",
      body: {spec, metadata: {projectId: "../escape"}},
    });
    assert.equal(result.status, 400);
    assert.match(result.body.error, /path-safe identifier/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, {recursive: true, force: true});
  }
});
