import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {mkdtemp, readFile, readdir, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {ForgeIdentityStore} from "../hercules-forge/identity.mjs";
import {
  HttpForgeNotificationAdapter,
  MemoryForgeNotificationAdapter,
} from "../hercules-forge/notifications.mjs";

function fixtureCredential() {
  return randomBytes(24).toString("base64url");
}

test("invite lifecycle stores only hashed token state and creates verified workspace member once", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-identity-invite-"));
  try {
    const identities = new ForgeIdentityStore(root);
    const owner = await identities.createUser({
      userId: "owner-a",
      email: "owner-a@example.com",
      password: fixtureCredential(),
    });
    await identities.createWorkspace({
      workspaceId: "workspace-a",
      name: "Workspace A",
      ownerUserId: owner.userId,
    });

    const issued = await identities.createInvite({
      email: "builder@example.com",
      workspaceId: "workspace-a",
      role: "builder",
    });
    assert.ok(issued.token.length >= 32);
    assert.equal(issued.invite.email, "builder@example.com");

    const inviteDir = join(root, "identity", "lifecycle", "invites");
    const files = await readdir(inviteDir);
    assert.equal(files.length, 1);
    const persisted = await readFile(join(inviteDir, files[0]), "utf8");
    assert.equal(persisted.includes(issued.token), false);

    const accepted = await identities.consumeInvite({
      token: issued.token,
      password: fixtureCredential(),
    });
    assert.equal(accepted.membership.workspaceId, "workspace-a");
    assert.equal(accepted.membership.role, "builder");
    assert.ok(accepted.user.emailVerifiedAt);

    await assert.rejects(
      identities.consumeInvite({
        token: issued.token,
        password: fixtureCredential(),
      }),
      /invalid or expired invite/,
    );
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("recovery lifecycle is enumeration-safe at store boundary and revokes prior sessions", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-identity-recovery-"));
  try {
    const identities = new ForgeIdentityStore(root);
    const oldPassword = fixtureCredential();
    const newPassword = fixtureCredential();
    const user = await identities.createUser({
      userId: "user-a",
      email: "user-a@example.com",
      password: oldPassword,
    });
    const session = await identities.createSession({
      email: user.email,
      password: oldPassword,
    });

    assert.equal(
      await identities.createRecovery({email: "missing@example.com"}),
      null,
    );

    const issued = await identities.createRecovery({email: user.email});
    assert.ok(issued.token.length >= 32);
    const recoveryDir = join(root, "identity", "lifecycle", "recovery");
    const files = await readdir(recoveryDir);
    const persisted = await readFile(join(recoveryDir, files[0]), "utf8");
    assert.equal(persisted.includes(issued.token), false);

    const completed = await identities.completeRecovery({
      token: issued.token,
      password: newPassword,
    });
    assert.equal(completed.user.userId, "user-a");
    assert.equal(completed.revokedSessions, 1);
    assert.ok(completed.user.passwordUpdatedAt);

    await assert.rejects(identities.getSession(session.token), /unauthorized/);
    await assert.rejects(
      identities.createSession({email: user.email, password: oldPassword}),
      /invalid credentials/,
    );
    const newSession = await identities.createSession({
      email: user.email,
      password: newPassword,
    });
    assert.equal(newSession.user.userId, "user-a");

    await assert.rejects(
      identities.completeRecovery({token: issued.token, password: newPassword}),
      /invalid or expired recovery/,
    );
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("memory notification adapter captures validated invite and recovery links", async () => {
  const notifications = new MemoryForgeNotificationAdapter();
  await notifications.send({
    kind: "invite",
    to: "User@Example.com",
    link: "https://forge.example.test/?invite=abc",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });
  await notifications.send({
    kind: "recovery",
    to: "user@example.com",
    link: "https://forge.example.test/?recovery=abc",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });
  assert.equal(notifications.notifications.length, 2);
  assert.equal(notifications.notifications[0].to, "user@example.com");
});

test("HTTP notification adapter refuses redirects and oversized responses", async () => {
  const expiresAt = new Date(Date.now() + 60000).toISOString();
  const notification = {
    kind: "invite",
    to: "user@example.com",
    link: "https://forge.example.test/?invite=abc",
    expiresAt,
  };

  const redirecting = new HttpForgeNotificationAdapter({
    endpoint: "https://notify.example.test/send",
    fetchImpl: async (_url, options) => {
      assert.equal(options.redirect, "error");
      return {ok: false, status: 302, headers: {get: () => null}, text: async () => ""};
    },
  });
  await assert.rejects(redirecting.send(notification), /status 302/);

  const oversized = new HttpForgeNotificationAdapter({
    endpoint: "https://notify.example.test/send",
    maxResponseBytes: 16,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: {get: (name) => name === "content-length" ? "1000" : null},
      text: async () => "",
    }),
  });
  await assert.rejects(oversized.send(notification), /response too large/);
});
