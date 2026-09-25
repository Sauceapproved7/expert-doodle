import test from "node:test";
import assert from "node:assert/strict";
import {scryptSync} from "node:crypto";
import {mkdtemp, readFile, readdir, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {ForgeIdentityStore, SCRYPT_PROFILE} from "../hercules-forge/identity.mjs";

function fixtureCredential(...parts) {
  return parts.join("-");
}

test("identity store hashes passwords and opaque session tokens", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-identity-"));
  try {
    const identities = new ForgeIdentityStore(root);
    const user = await identities.createUser({
      userId: "owner-user",
      email: "Owner@Example.com",
      password: fixtureCredential("correct", "horse", "battery", "staple"),
    });
    assert.equal(user.email, "owner@example.com");
    assert.equal("passwordHash" in user, false);
    const storedUser = JSON.parse(await readFile(
      join(root, "identity", "users", "owner-user.json"),
      "utf8",
    ));
    assert.match(
      storedUser.passwordHash,
      new RegExp("^scrypt-v2\\$" + SCRYPT_PROFILE.N + "\\$" + SCRYPT_PROFILE.r + "\\$" + SCRYPT_PROFILE.p + "\\$"),
    );

    await assert.rejects(
      identities.createUser({
        userId: "duplicate-user",
        email: "owner@example.com",
        password: fixtureCredential("another", "sufficiently", "long", "fixture"),
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
      password: fixtureCredential("correct", "horse", "battery", "staple"),
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
    assert.equal(sessionContent.includes(fixtureCredential("correct", "horse", "battery", "staple")), false);

    await assert.rejects(
      identities.createSession({
        email: "owner@example.com",
        password: fixtureCredential("definitely", "wrong", "fixture", "value"),
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
      password: fixtureCredential("owner", "fixture", "long", "enough"),
    });
    const builder = await identities.createUser({
      userId: "builder",
      email: "builder@example.com",
      password: fixtureCredential("builder", "fixture", "long", "enough"),
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
      password: fixtureCredential("builder", "fixture", "long", "enough"),
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


test("legacy scrypt-v1 password hashes upgrade after successful login", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-identity-upgrade-"));
  try {
    const identities = new ForgeIdentityStore(root);
    const password = fixtureCredential("legacy", "fixture", "password", "long", "enough");
    const user = await identities.createUser({
      userId: "legacy-user",
      email: "legacy@example.com",
      password,
    });

    const salt = Buffer.from("00112233445566778899aabbccddeeff", "hex");
    const hash = scryptSync(password, salt, 32, {
      N: 2 ** 14,
      r: 8,
      p: 1,
      maxmem: 32 * 1024 * 1024,
    }).toString("hex");
    const userPath = join(root, "identity", "users", user.userId + ".json");
    const stored = JSON.parse(await readFile(userPath, "utf8"));
    stored.passwordHash = "scrypt-v1$" + salt.toString("hex") + "$" + hash;
    await import("node:fs/promises").then(({writeFile}) =>
      writeFile(userPath, JSON.stringify(stored, null, 2) + "\n", "utf8"),
    );

    const session = await identities.createSession({
      email: "legacy@example.com",
      password,
    });
    assert.equal(session.user.userId, "legacy-user");

    const upgraded = JSON.parse(await readFile(userPath, "utf8"));
    assert.match(
      upgraded.passwordHash,
      new RegExp("^scrypt-v2\\$" + SCRYPT_PROFILE.N + "\\$" + SCRYPT_PROFILE.r + "\\$" + SCRYPT_PROFILE.p + "\\$"),
    );
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
