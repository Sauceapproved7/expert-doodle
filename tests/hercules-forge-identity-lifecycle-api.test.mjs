import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, readdir, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createForgeControlService} from "../hercules-forge/control-api.mjs";
import {ForgeIdentityStore} from "../hercules-forge/identity.mjs";
import {MemoryForgeNotificationAdapter} from "../hercules-forge/notifications.mjs";
import {ForgeLoginRateLimiter} from "../hercules-forge/rate-limit.mjs";

function fixtureCredential(...parts) {
  return parts.join("-");
}

const controlToken = fixtureCredential("forge", "lifecycle", "control", "fixture", "credential");

async function start(root, {
  notificationAdapter = new MemoryForgeNotificationAdapter(),
  recoveryRateLimiter = new ForgeLoginRateLimiter({maxFailures: 10, windowMs: 60_000}),
} = {}) {
  const server = createForgeControlService({
    root,
    token: controlToken,
    notificationAdapter,
    recoveryRateLimiter,
    publicOrigin: "https://forge.example.test",
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    server,
    base: "http://127.0.0.1:" + server.address().port,
    notificationAdapter,
  };
}

async function login(base, email, password) {
  const response = await fetch(base + "/v1/session", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({email, password}),
  });
  const body = await response.json();
  return {
    status: response.status,
    body,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}

function lifecycleToken(link, kind) {
  return new URL(link).searchParams.get(kind);
}

test("workspace invite and recovery lifecycle is one-time, audited, and secret-safe", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-lifecycle-api-"));
  const identities = new ForgeIdentityStore(root);
  const ownerPassword = fixtureCredential("owner", "lifecycle", "password", "long", "enough");
  const invitedPassword = fixtureCredential("invited", "initial", "password", "long", "enough");
  const recoveredPassword = fixtureCredential("invited", "recovered", "password", "long", "enough");

  const owner = await identities.createUser({
    userId: "owner-a",
    email: "owner-a@example.com",
    password: ownerPassword,
  });
  await identities.createWorkspace({
    workspaceId: "workspace-a",
    name: "Workspace A",
    ownerUserId: owner.userId,
  });

  const {server, base, notificationAdapter} = await start(root);
  try {
    const health = await fetch(base + "/health");
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.version, "1.5");
    assert.equal(healthBody.identityLifecycle, true);

    const ownerLogin = await login(base, owner.email, ownerPassword);
    assert.equal(ownerLogin.status, 201);

    const inviteResponse = await fetch(base + "/v1/workspaces/workspace-a/invites", {
      method: "POST",
      headers: {
        cookie: ownerLogin.cookie,
        "content-type": "application/json",
        "x-forge-csrf": ownerLogin.body.csrfToken,
      },
      body: JSON.stringify({
        email: "builder@example.com",
        role: "builder",
      }),
    });
    assert.equal(inviteResponse.status, 201);
    const inviteBody = await inviteResponse.json();
    assert.equal(inviteBody.invite.role, "builder");
    assert.equal("token" in inviteBody.invite, false);
    assert.equal(notificationAdapter.notifications.length, 1);
    assert.equal(notificationAdapter.notifications[0].kind, "invite");

    const inviteToken = lifecycleToken(notificationAdapter.notifications[0].link, "invite");
    assert.ok(inviteToken?.length >= 32);
    assert.equal(JSON.stringify(inviteBody).includes(inviteToken), false);

    const accepted = await fetch(base + "/v1/invites/accept", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({
        token: inviteToken,
        password: invitedPassword,
      }),
    });
    assert.equal(accepted.status, 201);
    const acceptedBody = await accepted.json();
    assert.equal(acceptedBody.accepted, true);
    assert.equal(acceptedBody.membership.workspaceId, "workspace-a");
    assert.equal(acceptedBody.membership.role, "builder");
    assert.ok(acceptedBody.user.emailVerifiedAt);

    const reused = await fetch(base + "/v1/invites/accept", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({
        token: inviteToken,
        password: invitedPassword,
      }),
    });
    assert.equal(reused.status, 400);

    const invitedLogin = await login(base, "builder@example.com", invitedPassword);
    assert.equal(invitedLogin.status, 201);

    const existingRecovery = await fetch(base + "/v1/recovery/request", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({email: "builder@example.com"}),
    });
    assert.equal(existingRecovery.status, 202);
    assert.deepEqual(await existingRecovery.json(), {accepted: true});

    const missingRecovery = await fetch(base + "/v1/recovery/request", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({email: "missing@example.com"}),
    });
    assert.equal(missingRecovery.status, 202);
    assert.deepEqual(await missingRecovery.json(), {accepted: true});

    assert.equal(notificationAdapter.notifications.length, 2);
    assert.equal(notificationAdapter.notifications[1].kind, "recovery");
    const recoveryToken = lifecycleToken(notificationAdapter.notifications[1].link, "recovery");
    assert.ok(recoveryToken?.length >= 32);

    const completed = await fetch(base + "/v1/recovery/complete", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({
        token: recoveryToken,
        password: recoveredPassword,
      }),
    });
    assert.equal(completed.status, 200);
    const completedBody = await completed.json();
    assert.equal(completedBody.reset, true);
    assert.ok(completedBody.revokedSessions >= 1);

    const staleSession = await fetch(base + "/v1/me", {
      headers: {cookie: invitedLogin.cookie},
    });
    assert.equal(staleSession.status, 401);

    const oldPasswordLogin = await login(base, "builder@example.com", invitedPassword);
    assert.equal(oldPasswordLogin.status, 401);
    const recoveredLogin = await login(base, "builder@example.com", recoveredPassword);
    assert.equal(recoveredLogin.status, 201);

    const auditResponse = await fetch(base + "/v1/audit?limit=100", {
      headers: {authorization: "Bearer " + controlToken},
    });
    assert.equal(auditResponse.status, 200);
    const auditBody = await auditResponse.json();
    const types = new Set(auditBody.events.map((event) => event.type));
    assert.equal(types.has("identity.invite.create"), true);
    assert.equal(types.has("identity.invite.accept"), true);
    assert.equal(types.has("identity.recovery.request"), true);
    assert.equal(types.has("identity.recovery.complete"), true);

    const auditText = JSON.stringify(auditBody.events);
    assert.equal(auditText.includes(inviteToken), false);
    assert.equal(auditText.includes(recoveryToken), false);
    assert.equal(auditText.includes(invitedPassword), false);
    assert.equal(auditText.includes(recoveredPassword), false);
    assert.equal(auditText.includes(controlToken), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, {recursive: true, force: true});
  }
});

test("recovery request limiter blocks excess requests without exposing account state", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-lifecycle-rate-"));
  const {server, base} = await start(root, {
    recoveryRateLimiter: new ForgeLoginRateLimiter({maxFailures: 1, windowMs: 60_000}),
  });
  try {
    const first = await fetch(base + "/v1/recovery/request", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({email: "missing@example.com"}),
    });
    assert.equal(first.status, 202);
    assert.deepEqual(await first.json(), {accepted: true});

    const blocked = await fetch(base + "/v1/recovery/request", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({email: "missing@example.com"}),
    });
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, {recursive: true, force: true});
  }
});

test("failed invite delivery removes the one-time invite token", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-lifecycle-delivery-"));
  const identities = new ForgeIdentityStore(root);
  const ownerPassword = fixtureCredential("owner", "delivery", "password", "long", "enough");
  const owner = await identities.createUser({
    userId: "owner-a",
    email: "owner-a@example.com",
    password: ownerPassword,
  });
  await identities.createWorkspace({
    workspaceId: "workspace-a",
    name: "Workspace A",
    ownerUserId: owner.userId,
  });

  let attemptedLink = null;
  const notificationAdapter = {
    async send(notification) {
      attemptedLink = notification.link;
      throw new Error("fixture delivery failure");
    },
  };
  const {server, base} = await start(root, {notificationAdapter});
  try {
    const ownerLogin = await login(base, owner.email, ownerPassword);
    const response = await fetch(base + "/v1/workspaces/workspace-a/invites", {
      method: "POST",
      headers: {
        cookie: ownerLogin.cookie,
        "content-type": "application/json",
        "x-forge-csrf": ownerLogin.body.csrfToken,
      },
      body: JSON.stringify({
        email: "failed@example.com",
        role: "viewer",
      }),
    });
    assert.equal(response.status, 502);
    const token = lifecycleToken(attemptedLink, "invite");
    assert.ok(token?.length >= 32);

    const inviteDir = join(root, "identity", "lifecycle", "invites");
    let entries = [];
    try {
      entries = await readdir(inviteDir);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    assert.equal(entries.length, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, {recursive: true, force: true});
  }
});
