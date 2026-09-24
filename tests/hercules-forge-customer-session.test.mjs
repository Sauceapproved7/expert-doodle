import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createForgeControlService} from "../hercules-forge/control-api.mjs";
import {ForgeIdentityStore} from "../hercules-forge/identity.mjs";
import {StaticForgeInterpreter} from "../hercules-forge/interpreter.mjs";

function fixtureCredential(...parts) {
  return parts.join("-");
}

const controlToken = fixtureCredential("forge", "control", "v08", "fixture", "token");
const spec = {
  version: "0.1",
  name: "CustomerWorkspace",
  description: "Customer workspace fixture.",
  entities: [
    {name: "Task", fields: [{name: "title", type: "string", required: true}]},
  ],
  pages: [{name: "Tasks", kind: "list", entity: "Task"}],
  actions: [{name: "CreateTask", kind: "create", entity: "Task"}],
};

async function start(root) {
  const server = createForgeControlService({
    root,
    token: controlToken,
    interpreter: new StaticForgeInterpreter(spec),
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {server, base: "http://127.0.0.1:" + server.address().port};
}

async function login(base, email, password) {
  const response = await fetch(base + "/v1/session", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({email, password}),
  });
  const body = await response.json();
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  return {status: response.status, body, cookie};
}

test("customer session routes isolate workspaces and enforce roles", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-customer-api-"));
  const identities = new ForgeIdentityStore(root);
  const ownerA = await identities.createUser({
    userId: "owner-a",
    email: "owner-a@example.com",
    password: fixtureCredential("owner", "a", "fixture", "long", "enough"),
  });
  const builderA = await identities.createUser({
    userId: "builder-a",
    email: "builder-a@example.com",
    password: fixtureCredential("builder", "a", "fixture", "long", "enough"),
  });
  const ownerB = await identities.createUser({
    userId: "owner-b",
    email: "owner-b@example.com",
    password: fixtureCredential("owner", "b", "fixture", "long", "enough"),
  });
  await identities.createWorkspace({
    workspaceId: "workspace-a",
    name: "Workspace A",
    ownerUserId: ownerA.userId,
  });
  await identities.addMember({
    workspaceId: "workspace-a",
    userId: builderA.userId,
    role: "builder",
  });
  await identities.createWorkspace({
    workspaceId: "workspace-b",
    name: "Workspace B",
    ownerUserId: ownerB.userId,
  });

  const {server, base} = await start(root);
  try {
    const ownerLogin = await login(
      base,
      "owner-a@example.com",
      fixtureCredential("owner", "a", "fixture", "long", "enough"),
    );
    assert.equal(ownerLogin.status, 201);
    assert.match(ownerLogin.cookie, /^forge_session=/);
    assert.ok(ownerLogin.body.csrfToken);

    const csrfRefresh = await fetch(base + "/v1/session/csrf", {
      headers: {cookie: ownerLogin.cookie},
    });
    assert.equal(csrfRefresh.status, 200);
    const csrfRefreshBody = await csrfRefresh.json();
    assert.ok(csrfRefreshBody.csrfToken);
    assert.notEqual(csrfRefreshBody.csrfToken, ownerLogin.body.csrfToken);
    const ownerCsrf = csrfRefreshBody.csrfToken;

    const me = await fetch(base + "/v1/me", {
      headers: {cookie: ownerLogin.cookie},
    });
    assert.equal(me.status, 200);
    const meBody = await me.json();
    assert.equal(meBody.user.userId, "owner-a");
    assert.equal(meBody.workspaces.length, 1);

    const noCsrf = await fetch(
      base + "/v1/workspaces/workspace-a/projects/from-prompt",
      {
        method: "POST",
        headers: {
          cookie: ownerLogin.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({prompt: "build a task app"}),
      },
    );
    assert.equal(noCsrf.status, 403);

    const staleCsrf = await fetch(
      base + "/v1/workspaces/workspace-a/projects/from-prompt",
      {
        method: "POST",
        headers: {
          cookie: ownerLogin.cookie,
          "content-type": "application/json",
          "x-forge-csrf": ownerLogin.body.csrfToken,
        },
        body: JSON.stringify({prompt: "build a stale csrf app"}),
      },
    );
    assert.equal(staleCsrf.status, 403);

    const created = await fetch(
      base + "/v1/workspaces/workspace-a/projects/from-prompt",
      {
        method: "POST",
        headers: {
          cookie: ownerLogin.cookie,
          "content-type": "application/json",
          "x-forge-csrf": ownerCsrf,
        },
        body: JSON.stringify({
          prompt: "build a task app",
          metadata: {projectId: "customer-project"},
        }),
      },
    );
    assert.equal(created.status, 201);
    const createdBody = await created.json();
    assert.equal(createdBody.project.metadata.workspaceId, "workspace-a");
    assert.equal(createdBody.project.metadata.createdByUserId, "owner-a");

    const listed = await fetch(
      base + "/v1/workspaces/workspace-a/projects",
      {headers: {cookie: ownerLogin.cookie}},
    );
    assert.equal(listed.status, 200);
    const listedBody = await listed.json();
    assert.equal(listedBody.projects.length, 1);
    assert.equal(listedBody.projects[0].projectId, "customer-project");

    const crossWorkspace = await fetch(
      base + "/v1/workspaces/workspace-b/projects",
      {headers: {cookie: ownerLogin.cookie}},
    );
    assert.equal(crossWorkspace.status, 403);

    const builderLogin = await login(
      base,
      "builder-a@example.com",
      fixtureCredential("builder", "a", "fixture", "long", "enough"),
    );
    assert.equal(builderLogin.status, 201);

    const builderPreview = await fetch(
      base +
        "/v1/workspaces/workspace-a/projects/customer-project/revisions/" +
        encodeURIComponent(createdBody.revision.revisionId) +
        "/preview",
      {
        method: "POST",
        headers: {
          cookie: builderLogin.cookie,
          "x-forge-csrf": builderLogin.body.csrfToken,
        },
      },
    );
    assert.equal(builderPreview.status, 201);

    const builderSnapshot = await fetch(
      base + "/v1/workspaces/workspace-a/projects/customer-project/data/snapshots",
      {
        method: "POST",
        headers: {
          cookie: builderLogin.cookie,
          "x-forge-csrf": builderLogin.body.csrfToken,
        },
      },
    );
    assert.equal(builderSnapshot.status, 201);
    const builderSnapshotBody = await builderSnapshot.json();
    assert.equal(builderSnapshotBody.snapshot.verified, true);
    const runtimeSnapshotId = builderSnapshotBody.snapshot.snapshotId;

    const builderRestore = await fetch(
      base +
        "/v1/workspaces/workspace-a/projects/customer-project/data/snapshots/" +
        encodeURIComponent(runtimeSnapshotId) +
        "/restore",
      {
        method: "POST",
        headers: {
          cookie: builderLogin.cookie,
          "x-forge-csrf": builderLogin.body.csrfToken,
        },
      },
    );
    assert.equal(builderRestore.status, 403);

    const ownerRestore = await fetch(
      base +
        "/v1/workspaces/workspace-a/projects/customer-project/data/snapshots/" +
        encodeURIComponent(runtimeSnapshotId) +
        "/restore",
      {
        method: "POST",
        headers: {
          cookie: ownerLogin.cookie,
          "x-forge-csrf": ownerCsrf,
        },
      },
    );
    assert.equal(ownerRestore.status, 200);
    assert.equal((await ownerRestore.json()).restore.restored, true);

    const builderPublish = await fetch(
      base + "/v1/workspaces/workspace-a/projects/customer-project/publish",
      {
        method: "POST",
        headers: {
          cookie: builderLogin.cookie,
          "content-type": "application/json",
          "x-forge-csrf": builderLogin.body.csrfToken,
        },
        body: JSON.stringify({revisionId: createdBody.revision.revisionId}),
      },
    );
    assert.equal(builderPublish.status, 403);

    const ownerPublish = await fetch(
      base + "/v1/workspaces/workspace-a/projects/customer-project/publish",
      {
        method: "POST",
        headers: {
          cookie: ownerLogin.cookie,
          "content-type": "application/json",
          "x-forge-csrf": ownerCsrf,
        },
        body: JSON.stringify({revisionId: createdBody.revision.revisionId}),
      },
    );
    assert.equal(ownerPublish.status, 201);

    const builderAudit = await fetch(
      base + "/v1/workspaces/workspace-a/audit",
      {headers: {cookie: builderLogin.cookie}},
    );
    assert.equal(builderAudit.status, 403);

    const ownerAudit = await fetch(
      base + "/v1/workspaces/workspace-a/audit?limit=100",
      {headers: {cookie: ownerLogin.cookie}},
    );
    assert.equal(ownerAudit.status, 200);
    const ownerAuditBody = await ownerAudit.json();
    assert.equal(ownerAuditBody.integrity.verified, true);
    const workspaceAuditTypes = new Set(ownerAuditBody.events.map((event) => event.type));
    assert.equal(workspaceAuditTypes.has("project.create"), true);
    assert.equal(workspaceAuditTypes.has("preview.start"), true);
    assert.equal(workspaceAuditTypes.has("data.snapshot"), true);
    assert.equal(workspaceAuditTypes.has("data.restore"), true);
    assert.equal(workspaceAuditTypes.has("project.publish"), true);

    const globalAudit = await fetch(base + "/v1/audit?limit=100", {
      headers: {authorization: "Bearer " + controlToken},
    });
    assert.equal(globalAudit.status, 200);
    const globalAuditBody = await globalAudit.json();
    assert.equal(
      globalAuditBody.events.some((event) => event.type === "session.login"),
      true,
    );
    const auditText = JSON.stringify(globalAuditBody.events);
    assert.equal(
      auditText.includes(fixtureCredential("owner", "a", "fixture", "long", "enough")),
      false,
    );
    assert.equal(auditText.includes(controlToken), false);

    const logout = await fetch(base + "/v1/session", {
      method: "DELETE",
      headers: {
        cookie: ownerLogin.cookie,
        "x-forge-csrf": ownerCsrf,
      },
    });
    assert.equal(logout.status, 200);

    const afterLogout = await fetch(base + "/v1/me", {
      headers: {cookie: ownerLogin.cookie},
    });
    assert.equal(afterLogout.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, {recursive: true, force: true});
  }
});
