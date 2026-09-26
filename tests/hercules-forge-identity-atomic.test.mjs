import test from "node:test";
import assert from "node:assert/strict";
import {mkdir, mkdtemp, readdir, rm, utimes} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {ForgeIdentityStore} from "../hercules-forge/identity.mjs";

function fixtureValue(...parts) {
  return parts.join("-");
}

test("shared-volume invite token can be consumed by only one identity-store instance", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-identity-atomic-invite-"));
  try {
    const setup = new ForgeIdentityStore(root);
    const owner = await setup.createUser({
      userId: "owner-a",
      email: "owner@example.com",
      password: fixtureValue("owner", "fixture", "password", "long", "enough"),
    });
    await setup.createWorkspace({
      workspaceId: "workspace-a",
      name: "Workspace A",
      ownerUserId: owner.userId,
    });
    const issued = await setup.createInvite({
      email: "builder@example.com",
      workspaceId: "workspace-a",
      role: "builder",
    });

    const processA = new ForgeIdentityStore(root);
    const processB = new ForgeIdentityStore(root);
    const password = fixtureValue("builder", "fixture", "password", "long", "enough");

    const results = await Promise.allSettled([
      processA.consumeInvite({token: issued.token, password}),
      processB.consumeInvite({token: issued.token, password}),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.match(rejected[0].reason.message, /invalid or expired invite/);

    const accepted = fulfilled[0].value;
    assert.equal(accepted.membership.workspaceId, "workspace-a");
    assert.equal(accepted.membership.role, "builder");
    assert.equal("createdFromInviteId" in accepted.user, false);
    assert.equal("passwordVersion" in accepted.user, false);

    const login = await setup.createSession({
      email: "builder@example.com",
      password,
    });
    assert.equal(login.user.userId, accepted.user.userId);

    let inviteFiles = [];
    try {
      inviteFiles = await readdir(join(root, "identity", "lifecycle", "invites"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    assert.equal(inviteFiles.length, 0);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("concurrent outstanding recovery links allow only one password reset across processes", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-identity-atomic-recovery-"));
  try {
    const setup = new ForgeIdentityStore(root);
    const oldPassword = fixtureValue("old", "fixture", "password", "long", "enough");
    const passwordA = fixtureValue("new", "alpha", "password", "long", "enough");
    const passwordB = fixtureValue("new", "bravo", "password", "long", "enough");
    const user = await setup.createUser({
      userId: "user-a",
      email: "user@example.com",
      password: oldPassword,
    });
    const session = await setup.createSession({email: user.email, password: oldPassword});

    const first = await setup.createRecovery({email: user.email});
    const second = await setup.createRecovery({email: user.email});
    assert.equal(first.recovery.passwordVersion, 1);
    assert.equal(second.recovery.passwordVersion, 1);

    const processA = new ForgeIdentityStore(root);
    const processB = new ForgeIdentityStore(root);
    const results = await Promise.allSettled([
      processA.completeRecovery({token: first.token, password: passwordA}),
      processB.completeRecovery({token: second.token, password: passwordB}),
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.filter((result) => result.status === "rejected");
    assert.equal(rejected.length, 1);
    assert.match(rejected[0].reason.message, /invalid or expired recovery/);

    await assert.rejects(setup.getSession(session.token), /unauthorized/);
    await assert.rejects(
      setup.createSession({email: user.email, password: oldPassword}),
      /invalid credentials/,
    );

    const candidates = [];
    for (const candidate of [passwordA, passwordB]) {
      try {
        const loggedIn = await setup.createSession({email: user.email, password: candidate});
        candidates.push(loggedIn);
      } catch (error) {
        assert.match(error.message, /invalid credentials/);
      }
    }
    assert.equal(candidates.length, 1);

    let recoveryFiles = [];
    try {
      recoveryFiles = await readdir(join(root, "identity", "lifecycle", "recovery"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    assert.equal(recoveryFiles.length, 0);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("different invite tokens for one email cannot create duplicate accounts concurrently", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-identity-atomic-email-"));
  try {
    const setup = new ForgeIdentityStore(root);
    const owner = await setup.createUser({
      userId: "owner-a",
      email: "owner@example.com",
      password: fixtureValue("owner", "fixture", "password", "long", "enough"),
    });
    await setup.createWorkspace({
      workspaceId: "workspace-a",
      name: "Workspace A",
      ownerUserId: owner.userId,
    });
    const first = await setup.createInvite({
      email: "member@example.com",
      workspaceId: "workspace-a",
      role: "builder",
    });
    const second = await setup.createInvite({
      email: "member@example.com",
      workspaceId: "workspace-a",
      role: "viewer",
    });

    const processA = new ForgeIdentityStore(root);
    const processB = new ForgeIdentityStore(root);
    const password = fixtureValue("member", "fixture", "password", "long", "enough");
    const results = await Promise.allSettled([
      processA.consumeInvite({token: first.token, password}),
      processB.consumeInvite({token: second.token, password}),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);

    const users = (await readdir(join(root, "identity", "users"))).filter((name) => name.endsWith(".json"));
    assert.equal(users.length, 2); // owner + one invited member
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("stale shared-volume lifecycle locks are reclaimed", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-identity-stale-lock-"));
  try {
    const store = new ForgeIdentityStore(root, {
      lockTimeoutMs: 1000,
      lockStaleMs: 10_000,
    });
    const lockPath = store.lockPath("fixture-lock");
    await mkdir(dirname(lockPath), {recursive: true});
    await mkdir(lockPath);
    const old = new Date(Date.now() - 60_000);
    await utimes(lockPath, old, old);

    const value = await store.withLifecycleLock("fixture-lock", async () => "reclaimed");
    assert.equal(value, "reclaimed");

    let locks = [];
    try {
      locks = await readdir(join(root, "identity", "locks"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    assert.equal(locks.length, 0);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("concurrent old-password login cannot leave a valid session after recovery", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-identity-login-reset-race-"));
  try {
    const setup = new ForgeIdentityStore(root);
    const oldPassword = fixtureValue("race", "old", "password", "long", "enough");
    const newPassword = fixtureValue("race", "new", "password", "long", "enough");
    const user = await setup.createUser({
      userId: "race-user",
      email: "race@example.com",
      password: oldPassword,
    });
    const recovery = await setup.createRecovery({email: user.email});

    const loginProcess = new ForgeIdentityStore(root);
    const recoveryProcess = new ForgeIdentityStore(root);
    const [loginResult, recoveryResult] = await Promise.allSettled([
      loginProcess.createSession({email: user.email, password: oldPassword}),
      recoveryProcess.completeRecovery({token: recovery.token, password: newPassword}),
    ]);

    assert.equal(recoveryResult.status, "fulfilled");
    if (loginResult.status === "fulfilled") {
      await assert.rejects(setup.getSession(loginResult.value.token), /unauthorized/);
    } else {
      assert.match(loginResult.reason.message, /invalid credentials/);
    }

    await assert.rejects(
      setup.createSession({email: user.email, password: oldPassword}),
      /invalid credentials/,
    );
    const current = await setup.createSession({email: user.email, password: newPassword});
    assert.equal(current.user.userId, "race-user");
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
