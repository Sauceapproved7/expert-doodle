import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, readFile, readdir, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {ForgeIdentityStore} from "../hercules-forge/identity.mjs";

test("identity store hashes passwords and opaque session tokens", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-identity-"));
  try {
    const identities = new ForgeIdentityStore(root);
    const user = await identities.createUser({
      userId: "owner-user",
      email: "Owner@Example.com",
      password: "correct horse battery staple",
    });
    assert.equal(user.email, "owner@example.com");
    assert.equal("passwordHash" in user, false);

    await assert.rejects(
      identities.createUser({
        userId: "duplicate-user",
        email: "owner@example.com",
        password: "another sufficiently long password",
      }),
      /email already exists/,
    );

    const workspace = await identities.createWorkspace({
      workspaceId: "alpha-workspace",
      name: "Alpha Workspace",
      ownerUserId: user.userId,
    });
    assert.equal(workspace.workspaceId, "alpha-workspace");

    const loggedIn = await identities.createSession({
      email: "OWNER@example.com",
      password: "correct horse battery staple",
    });
    assert.match(loggedIn.token, /^[A-Za-z0-9_-]+$/);
    assert.ok(loggedIn.csrfToken.length >= 24);

    await identities.requireCsrf(loggedIn.token, loggedIn.csrfToken);
    const access = await identities.requireWorkspace(
      loggedIn.token,
      "alpha-workspace",
      ["owner"],
    );
    assert.equal(access.membership.role, "owner");

    const sessionFiles = await readdir(join(root, "identity", "sessions"));
    assert.equal(sessionFiles.length, 1);
    assert.equal(sessionFiles[0].includes(loggedIn.token), false);
    const sessionContent = await readFile(
      join(root, "identity", "sessions", sessionFiles[0]),
      "utf8",
    );
    assert.equal(sessionContent.includes(loggedIn.token), false);
    assert.equal(sessionContent.includes("correct horse battery staple"), false);

    await assert.rejects(
      identities.createSession({
        email: "owner@example.com",
        password: "definitely wrong password",
      }),
      /invalid credentials/,
    );
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("workspace roles are explicit and enforced", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-identity-role-"));
  try {
    const identities = new ForgeIdentityStore(root);
    const owner = await identities.createUser({
      userId: "owner",
      email: "owner@example.com",
      password: "owner password long enough",
    });
    const builder = await identities.createUser({
      userId: "builder",
      email: "builder@example.com",
      password: "builder password long enough",
    });
    await identities.createWorkspace({
      workspaceId: "workspace-a",
      name: "Workspace A",
      ownerUserId: owner.userId,
    });
    await identities.addMember({
      workspaceId: "workspace-a",
      userId: builder.userId,
      role: "builder",
    });

    const login = await identities.createSession({
      email: "builder@example.com",
      password: "builder password long enough",
    });
    const builderAccess = await identities.requireWorkspace(
      login.token,
      "workspace-a",
      ["builder"],
    );
    assert.equal(builderAccess.membership.role, "builder");

    await assert.rejects(
      identities.requireWorkspace(login.token, "workspace-a", ["owner", "admin"]),
      /workspace role denied/,
    );
    await assert.rejects(
      identities.requireWorkspace(login.token, "missing-workspace"),
      /workspace access denied/,
    );
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
