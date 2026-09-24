import test from "node:test";
import assert from "node:assert/strict";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
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
    assert.equal(health.body.persistentRuntime, true);
    assert.equal(health.body.version, "1.4");
    assert.equal(health.body.runtimeDataControl, true);
    assert.equal(health.body.auditEvents, true);
    assert.ok(health.body.runtimeDataMaxBytes > 0);

    const consoleResponse = await fetch(base + "/");
    assert.equal(consoleResponse.status, 200);
    assert.match(consoleResponse.headers.get("content-type"), /text\/html/);
    const consoleHtml = await consoleResponse.text();
    assert.match(consoleHtml, /HERCULES FORGE/);
    assert.match(consoleHtml, /Sign in/);
    assert.match(consoleHtml, /Runtime data/);
    assert.match(consoleHtml, /Create snapshot/);
    assert.match(consoleHtml, /Security audit/);
    assert.equal(consoleHtml.includes("Control token"), false);
    assert.equal(consoleHtml.includes(token), false);

    const operatorResponse = await fetch(base + "/operator");
    assert.equal(operatorResponse.status, 200);
    const operatorHtml = await operatorResponse.text();
    assert.match(operatorHtml, /Control token/);
    assert.equal(operatorHtml.includes(token), false);

    const deniedList = await request(base, "/v1/projects", {authorized: false});
    assert.equal(deniedList.status, 401);

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

    const listed = await request(base, "/v1/projects");
    assert.equal(listed.status, 200);
    assert.equal(listed.body.projects.length, 1);
    assert.equal(listed.body.projects[0].projectId, "control-app");
    assert.equal(listed.body.projects[0].latestRevisionId, firstRevisionId);

    const runtimeDir = join(root, "runtime-data", "control-app");
    await mkdir(runtimeDir, {recursive: true});
    const runtimeOriginal = JSON.stringify({
      note1: {id: "note1", body: "original"},
    }, null, 2) + "\n";
    await writeFile(join(runtimeDir, "Note.json"), runtimeOriginal, "utf8");

    const usage = await request(base, "/v1/projects/control-app/data/usage");
    assert.equal(usage.status, 200);
    assert.equal(usage.body.usage.files, 1);
    assert.equal(usage.body.usage.totalBytes, Buffer.byteLength(runtimeOriginal));

    const snap = await request(base, "/v1/projects/control-app/data/snapshots", {
      method: "POST",
    });
    assert.equal(snap.status, 201);
    assert.equal(snap.body.snapshot.verified, true);
    const snapshotId = snap.body.snapshot.snapshotId;

    const verified = await request(
      base,
      "/v1/projects/control-app/data/snapshots/" + snapshotId,
    );
    assert.equal(verified.status, 200);
    assert.equal(verified.body.snapshot.verified, true);

    await writeFile(
      join(runtimeDir, "Note.json"),
      JSON.stringify({note2: {id: "note2", body: "changed"}}, null, 2) + "\n",
      "utf8",
    );
    const restoredData = await request(
      base,
      "/v1/projects/control-app/data/snapshots/" + snapshotId + "/restore",
      {method: "POST"},
    );
    assert.equal(restoredData.status, 200);
    assert.equal(restoredData.body.restore.restored, true);
    assert.equal(await readFile(join(runtimeDir, "Note.json"), "utf8"), runtimeOriginal);

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

    const auditDenied = await request(base, "/v1/audit", {authorized: false});
    assert.equal(auditDenied.status, 401);

    const auditIntegrity = await request(base, "/v1/audit/verify");
    assert.equal(auditIntegrity.status, 200);
    assert.equal(auditIntegrity.body.integrity.verified, true);
    assert.ok(auditIntegrity.body.integrity.events >= 8);

    const auditEvents = await request(
      base,
      "/v1/audit?projectId=control-app&limit=100",
    );
    assert.equal(auditEvents.status, 200);
    const types = new Set(auditEvents.body.events.map((event) => event.type));
    assert.equal(types.has("project.create"), true);
    assert.equal(types.has("data.snapshot"), true);
    assert.equal(types.has("data.restore"), true);
    assert.equal(types.has("artifact.build"), true);
    assert.equal(types.has("project.revision"), true);
    assert.equal(types.has("project.publish"), true);
    assert.equal(types.has("project.rollback"), true);
    assert.equal(
      JSON.stringify(auditEvents.body.events).includes(token),
      false,
    );
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
