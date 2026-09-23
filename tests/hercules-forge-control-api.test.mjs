import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {once} from "node:events";
import {createForgeControlServer} from "../hercules-forge/control-api.mjs";

const token = "test-operator-token";
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
  const server = createForgeControlServer({root, operatorToken: token});
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const {port} = server.address();
  return {server, base: "http://127.0.0.1:" + port};
}

async function request(base, path, options = {}) {
  const headers = {
    "content-type": "application/json",
    authorization: "Bearer " + token,
    ...(options.headers ?? {}),
  };
  const response = await fetch(base + path, {...options, headers});
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

test("control API fails closed without operator credentials", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-api-auth-"));
  const {server, base} = await start(root);
  try {
    const response = await fetch(base + "/v1/projects");
    assert.equal(response.status, 401);
  } finally {
    server.close();
    await once(server, "close");
    await rm(root, {recursive: true, force: true});
  }
});

test("control API owns create, revise, publish, inspect, and rollback flow", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-api-flow-"));
  const {server, base} = await start(root);
  try {
    const created = await request(base, "/v1/projects", {
      method: "POST",
      body: JSON.stringify({
        spec,
        metadata: {projectId: "control-app"},
      }),
    });
    assert.equal(created.status, 201);
    const firstRevision = created.body.revision.revisionId;

    const nextSpec = structuredClone(spec);
    nextSpec.description = "Forge control API fixture v2.";
    const revised = await request(base, "/v1/projects/control-app/revisions", {
      method: "POST",
      body: JSON.stringify({spec: nextSpec, message: "v2"}),
    });
    assert.equal(revised.status, 201);
    const secondRevision = revised.body.revisionId;

    const publishedFirst = await request(
      base,
      "/v1/projects/control-app/revisions/" + firstRevision + "/publish",
      {method: "POST"},
    );
    assert.equal(publishedFirst.status, 201);
    assert.equal(publishedFirst.body.verified, true);

    const publishedSecond = await request(
      base,
      "/v1/projects/control-app/revisions/" + secondRevision + "/publish",
      {method: "POST"},
    );
    assert.equal(publishedSecond.status, 201);

    const activeSecond = await request(
      base,
      "/v1/projects/control-app/releases/active",
    );
    assert.equal(activeSecond.status, 200);
    assert.equal(activeSecond.body.revisionId, secondRevision);

    const rollback = await request(
      base,
      "/v1/projects/control-app/releases/" + firstRevision + "/rollback",
      {method: "POST"},
    );
    assert.equal(rollback.status, 200);
    assert.equal(rollback.body.revisionId, firstRevision);
    assert.equal(rollback.body.rollback, true);
  } finally {
    server.close();
    await once(server, "close");
    await rm(root, {recursive: true, force: true});
  }
});
