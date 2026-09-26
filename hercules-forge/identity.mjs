import {createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual} from "node:crypto";
import {chmod, mkdir, readFile, readdir, rm, writeFile} from "node:fs/promises";
import {dirname, join} from "node:path";
import {promisify} from "node:util";

const scrypt = promisify(scryptCallback);
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = new Set(["owner", "admin", "builder", "viewer"]);
const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_INVITE_TTL_MS = 72 * 60 * 60 * 1000;
const DEFAULT_RECOVERY_TTL_MS = 30 * 60 * 1000;
const INVITE_ROLES = new Set(["admin", "builder", "viewer"]);
const LIFECYCLE_KINDS = new Set(["invites", "recovery"]);

// OWASP Password Storage Cheat Sheet (2026): one accepted scrypt profile is
// N=2^15, r=8, p=3. Keep the parameters encoded with each password hash so
// future upgrades remain backward compatible.
export const SCRYPT_PROFILE = Object.freeze({
  version: "scrypt-v2",
  N: 2 ** 15,
  r: 8,
  p: 3,
  keylen: 32,
  maxmem: 64 * 1024 * 1024,
});

function assertId(label, value) {
  if (!ID.test(String(value ?? ""))) throw new Error(label + " must be a path-safe identifier");
  return String(value);
}

function normalizeEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) throw new TypeError("valid email is required");
  return email;
}

function safeUser(user) {
  const {passwordHash, ...publicUser} = user;
  return publicUser;
}

function hashToken(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value, options = {}) {
  await mkdir(dirname(path), {recursive: true});
  await writeFile(path, json(value), {encoding: "utf8", mode: 0o600, ...options});
  await chmod(path, 0o600);
}

async function derivePassword(password, saltHex = null, profile = SCRYPT_PROFILE) {
  if (typeof password !== "string" || password.length < 12 || password.length > 1024) {
    throw new TypeError("password must be between 12 and 1024 characters");
  }
  const salt = saltHex ? Buffer.from(saltHex, "hex") : randomBytes(16);
  const key = await scrypt(password, salt, profile.keylen, {
    N: profile.N,
    r: profile.r,
    p: profile.p,
    maxmem: profile.maxmem,
  });
  return {
    salt: salt.toString("hex"),
    hash: Buffer.from(key).toString("hex"),
  };
}

async function verifyPassword(password, encoded) {
  const parts = String(encoded ?? "").split("$");
  const scheme = parts[0];

  let profile;
  let salt;
  let expectedHex;

  if (scheme === "scrypt-v2" && parts.length === 6) {
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    salt = parts[4];
    expectedHex = parts[5];
    if (
      !Number.isSafeInteger(N) || N < 2 ** 14 || N > 2 ** 20 ||
      !Number.isSafeInteger(r) || r < 1 || r > 32 ||
      !Number.isSafeInteger(p) || p < 1 || p > 16 ||
      !salt || !expectedHex
    ) return false;
    profile = {
      version: "scrypt-v2",
      N,
      r,
      p,
      keylen: expectedHex.length / 2,
      maxmem: Math.max(64 * 1024 * 1024, 128 * N * r + 8 * 1024 * 1024),
    };
  } else if (scheme === "scrypt-v1" && parts.length === 3) {
    // Backward compatibility for existing Hercules identities created before
    // the explicit work-factor hardening. New identities never use v1.
    salt = parts[1];
    expectedHex = parts[2];
    profile = {
      version: "scrypt-v1",
      N: 2 ** 14,
      r: 8,
      p: 1,
      keylen: expectedHex.length / 2,
      maxmem: 32 * 1024 * 1024,
    };
  } else {
    return false;
  }

  if (!Number.isSafeInteger(profile.keylen) || profile.keylen < 16 || profile.keylen > 64) return false;
  const derived = await derivePassword(password, salt, profile);
  const actual = Buffer.from(derived.hash, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export class ForgeIdentityStore {
  constructor(root) {
    this.root = join(root, "identity");
    this.lifecycleQueue = Promise.resolve();
  }

  userPath(userId) {
    return join(this.root, "users", assertId("userId", userId) + ".json");
  }

  emailIndexPath(email) {
    return join(this.root, "email-index", hashToken(normalizeEmail(email)) + ".json");
  }

  workspacePath(workspaceId) {
    return join(this.root, "workspaces", assertId("workspaceId", workspaceId) + ".json");
  }

  membershipPath(userId, workspaceId) {
    return join(
      this.root,
      "memberships",
      assertId("userId", userId),
      assertId("workspaceId", workspaceId) + ".json",
    );
  }

  sessionPath(token) {
    return join(this.root, "sessions", hashToken(token) + ".json");
  }

  lifecyclePath(kind, token) {
    if (!LIFECYCLE_KINDS.has(kind)) throw new TypeError("invalid lifecycle token kind");
    return join(this.root, "lifecycle", kind, hashToken(token) + ".json");
  }

  async withLifecycleLock(operation) {
    const previous = this.lifecycleQueue.catch(() => {});
    const current = previous.then(operation);
    this.lifecycleQueue = current;
    try {
      return await current;
    } finally {
      if (this.lifecycleQueue === current) this.lifecycleQueue = Promise.resolve();
    }
  }

  async createUser({
    email,
    password,
    userId = randomUUID(),
    emailVerifiedAt = new Date().toISOString(),
  }) {
    email = normalizeEmail(email);
    userId = assertId("userId", userId);
    const passwordParts = await derivePassword(password);
    const now = new Date().toISOString();
    const user = {
      userId,
      email,
      passwordHash: [
        SCRYPT_PROFILE.version,
        SCRYPT_PROFILE.N,
        SCRYPT_PROFILE.r,
        SCRYPT_PROFILE.p,
        passwordParts.salt,
        passwordParts.hash,
      ].join("$"),
      createdAt: now,
      emailVerifiedAt,
      passwordUpdatedAt: now,
    };

    const indexPath = this.emailIndexPath(email);
    try {
      await writeJson(indexPath, {userId}, {flag: "wx"});
    } catch (error) {
      if (error?.code === "EEXIST") {
        throw Object.assign(new Error("email already exists"), {statusCode: 409});
      }
      throw error;
    }

    try {
      await writeJson(this.userPath(userId), user, {flag: "wx"});
    } catch (error) {
      await rm(indexPath, {force: true});
      throw error;
    }

    return safeUser(user);
  }

  async getUser(userId) {
    return safeUser(await readJson(this.userPath(userId)));
  }

  async getUserByEmail(email) {
    const index = await readJson(this.emailIndexPath(email));
    return readJson(this.userPath(index.userId));
  }

  async revokeLifecycleToken(kind, token) {
    if (typeof token !== "string" || token.length < 32) return false;
    await rm(this.lifecyclePath(kind, token), {force: true});
    return true;
  }

  async createInvite({
    email,
    workspaceId,
    role = "viewer",
    ttlMs = DEFAULT_INVITE_TTL_MS,
  }) {
    email = normalizeEmail(email);
    workspaceId = assertId("workspaceId", workspaceId);
    if (!INVITE_ROLES.has(role)) throw new TypeError("invalid invite role");
    if (!Number.isFinite(ttlMs) || ttlMs < 5 * 60 * 1000 || ttlMs > 7 * 24 * 60 * 60 * 1000) {
      throw new TypeError("invalid invite ttl");
    }
    await this.getWorkspace(workspaceId);
    try {
      await this.getUserByEmail(email);
      throw Object.assign(new Error("email already exists"), {statusCode: 409});
    } catch (error) {
      if (error?.statusCode === 409) throw error;
      if (error?.code !== "ENOENT") throw error;
    }

    const token = randomBytes(32).toString("base64url");
    const now = Date.now();
    const invite = {
      inviteId: randomUUID(),
      email,
      workspaceId,
      role,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
    };
    await writeJson(this.lifecyclePath("invites", token), invite, {flag: "wx"});
    return {token, invite};
  }

  async consumeInvite({token, password}) {
    if (typeof token !== "string" || token.length < 32) {
      throw Object.assign(new Error("invalid or expired invite"), {statusCode: 400});
    }
    return this.withLifecycleLock(async () => {
      const path = this.lifecyclePath("invites", token);
      let invite;
      try {
        invite = await readJson(path);
      } catch (error) {
        if (error?.code === "ENOENT") {
          throw Object.assign(new Error("invalid or expired invite"), {statusCode: 400});
        }
        throw error;
      }
      if (Date.parse(invite.expiresAt) <= Date.now()) {
        await rm(path, {force: true});
        throw Object.assign(new Error("invalid or expired invite"), {statusCode: 400});
      }
      await this.getWorkspace(invite.workspaceId);
      await derivePassword(password);

      const user = await this.createUser({
        email: invite.email,
        password,
        emailVerifiedAt: new Date().toISOString(),
      });
      try {
        const membership = await this.addMember({
          workspaceId: invite.workspaceId,
          userId: user.userId,
          role: invite.role,
        });
        await rm(path, {force: true});
        return {inviteId: invite.inviteId, user, membership};
      } catch (error) {
        await Promise.all([
          rm(this.userPath(user.userId), {force: true}),
          rm(this.emailIndexPath(invite.email), {force: true}),
        ]);
        throw error;
      }
    });
  }

  async createRecovery({email, ttlMs = DEFAULT_RECOVERY_TTL_MS}) {
    email = normalizeEmail(email);
    if (!Number.isFinite(ttlMs) || ttlMs < 5 * 60 * 1000 || ttlMs > 24 * 60 * 60 * 1000) {
      throw new TypeError("invalid recovery ttl");
    }
    let user;
    try {
      user = await this.getUserByEmail(email);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }

    const token = randomBytes(32).toString("base64url");
    const now = Date.now();
    const recovery = {
      recoveryId: randomUUID(),
      userId: user.userId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
    };
    await writeJson(this.lifecyclePath("recovery", token), recovery, {flag: "wx"});
    return {token, recovery, user: safeUser(user)};
  }

  async revokeUserSessions(userId) {
    userId = assertId("userId", userId);
    const dir = join(this.root, "sessions");
    let entries;
    try {
      entries = await readdir(dir, {withFileTypes: true});
    } catch (error) {
      if (error?.code === "ENOENT") return 0;
      throw error;
    }
    let revoked = 0;
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const path = join(dir, entry.name);
      let session;
      try {
        session = await readJson(path);
      } catch {
        continue;
      }
      if (session.userId !== userId) continue;
      await rm(path, {force: true});
      revoked += 1;
    }
    return revoked;
  }

  async completeRecovery({token, password}) {
    if (typeof token !== "string" || token.length < 32) {
      throw Object.assign(new Error("invalid or expired recovery"), {statusCode: 400});
    }
    return this.withLifecycleLock(async () => {
      const path = this.lifecyclePath("recovery", token);
      let recovery;
      try {
        recovery = await readJson(path);
      } catch (error) {
        if (error?.code === "ENOENT") {
          throw Object.assign(new Error("invalid or expired recovery"), {statusCode: 400});
        }
        throw error;
      }
      if (Date.parse(recovery.expiresAt) <= Date.now()) {
        await rm(path, {force: true});
        throw Object.assign(new Error("invalid or expired recovery"), {statusCode: 400});
      }

      const passwordParts = await derivePassword(password);
      const user = await readJson(this.userPath(recovery.userId));
      const updated = {
        ...user,
        passwordHash: [
          SCRYPT_PROFILE.version,
          SCRYPT_PROFILE.N,
          SCRYPT_PROFILE.r,
          SCRYPT_PROFILE.p,
          passwordParts.salt,
          passwordParts.hash,
        ].join("$"),
        passwordUpdatedAt: new Date().toISOString(),
      };
      await writeJson(this.userPath(recovery.userId), updated);
      const revokedSessions = await this.revokeUserSessions(recovery.userId);
      await rm(path, {force: true});
      return {
        recoveryId: recovery.recoveryId,
        user: safeUser(updated),
        revokedSessions,
      };
    });
  }

  async createWorkspace({name, ownerUserId, workspaceId = randomUUID()}) {
    workspaceId = assertId("workspaceId", workspaceId);
    ownerUserId = assertId("ownerUserId", ownerUserId);
    await this.getUser(ownerUserId);
    const cleanName = String(name ?? "").trim();
    if (!cleanName || cleanName.length > 120) throw new TypeError("workspace name is required");

    const workspace = {
      workspaceId,
      name: cleanName,
      createdAt: new Date().toISOString(),
    };
    await writeJson(this.workspacePath(workspaceId), workspace, {flag: "wx"});
    await this.addMember({workspaceId, userId: ownerUserId, role: "owner"});
    return workspace;
  }

  async getWorkspace(workspaceId) {
    return readJson(this.workspacePath(workspaceId));
  }

  async addMember({workspaceId, userId, role}) {
    workspaceId = assertId("workspaceId", workspaceId);
    userId = assertId("userId", userId);
    if (!ROLES.has(role)) throw new TypeError("invalid workspace role");
    await Promise.all([this.getWorkspace(workspaceId), this.getUser(userId)]);
    const membership = {
      workspaceId,
      userId,
      role,
      updatedAt: new Date().toISOString(),
    };
    await writeJson(this.membershipPath(userId, workspaceId), membership);
    return membership;
  }

  async getMembership(userId, workspaceId) {
    return readJson(this.membershipPath(userId, workspaceId));
  }

  async listUserWorkspaces(userId) {
    userId = assertId("userId", userId);
    const dir = join(this.root, "memberships", userId);
    let entries;
    try {
      entries = await readdir(dir, {withFileTypes: true});
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }

    const result = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const membership = await readJson(join(dir, entry.name));
      const workspace = await this.getWorkspace(membership.workspaceId);
      result.push({workspace, membership});
    }
    return result.sort((a, b) => a.workspace.name.localeCompare(b.workspace.name));
  }

  async createSession({email, password, ttlMs = DEFAULT_SESSION_TTL_MS}) {
    if (!Number.isFinite(ttlMs) || ttlMs < 60_000 || ttlMs > 30 * 24 * 60 * 60 * 1000) {
      throw new TypeError("invalid session ttl");
    }
    let user;
    try {
      user = await this.getUserByEmail(email);
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw Object.assign(new Error("invalid credentials"), {statusCode: 401});
      }
      throw error;
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw Object.assign(new Error("invalid credentials"), {statusCode: 401});
    }

    // Upgrade legacy hashes only after a successful password verification.
    // This preserves compatibility while ensuring active accounts converge on
    // the hardened profile without a forced password reset.
    // Upgrade legacy hashes only after a successful password verification.
    if (String(user.passwordHash).startsWith("scrypt-v1$")) {
      const passwordParts = await derivePassword(password);
      user = {
        ...user,
        passwordHash: [
          SCRYPT_PROFILE.version,
          SCRYPT_PROFILE.N,
          SCRYPT_PROFILE.r,
          SCRYPT_PROFILE.p,
          passwordParts.salt,
          passwordParts.hash,
        ].join("$"),
      };
      await writeJson(this.userPath(user.userId), user);
    }

    const token = randomBytes(32).toString("base64url");
    const csrfToken = randomBytes(24).toString("base64url");
    const now = Date.now();
    const session = {
      sessionId: randomUUID(),
      userId: user.userId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
      csrfSha256: hashToken(csrfToken),
    };
    await writeJson(this.sessionPath(token), session, {flag: "wx"});
    return {token, csrfToken, session, user: safeUser(user)};
  }

  async getSession(token) {
    if (typeof token !== "string" || token.length < 32) {
      throw Object.assign(new Error("unauthorized"), {statusCode: 401});
    }
    let session;
    try {
      session = await readJson(this.sessionPath(token));
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw Object.assign(new Error("unauthorized"), {statusCode: 401});
      }
      throw error;
    }
    if (Date.parse(session.expiresAt) <= Date.now()) {
      await rm(this.sessionPath(token), {force: true});
      throw Object.assign(new Error("session expired"), {statusCode: 401});
    }
    return {session, user: await this.getUser(session.userId)};
  }

  async requireCsrf(token, csrfToken) {
    const auth = await this.getSession(token);
    const supplied = Buffer.from(hashToken(String(csrfToken ?? "")), "hex");
    const expected = Buffer.from(auth.session.csrfSha256, "hex");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw Object.assign(new Error("invalid csrf token"), {statusCode: 403});
    }
    return auth;
  }

  async rotateCsrf(token) {
    const auth = await this.getSession(token);
    const csrfToken = randomBytes(24).toString("base64url");
    const session = {
      ...auth.session,
      csrfSha256: hashToken(csrfToken),
    };
    await writeJson(this.sessionPath(token), session);
    return {csrfToken, session, user: auth.user};
  }

  async requireWorkspace(token, workspaceId, allowedRoles = null) {
    const auth = await this.getSession(token);
    let membership;
    try {
      membership = await this.getMembership(auth.user.userId, workspaceId);
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw Object.assign(new Error("workspace access denied"), {statusCode: 403});
      }
      throw error;
    }
    if (allowedRoles && !allowedRoles.includes(membership.role)) {
      throw Object.assign(new Error("workspace role denied"), {statusCode: 403});
    }
    return {...auth, membership, workspace: await this.getWorkspace(workspaceId)};
  }

  async revokeSession(token) {
    if (typeof token !== "string" || token.length < 32) return false;
    await rm(this.sessionPath(token), {force: true});
    return true;
  }
}

export {normalizeEmail, verifyPassword};
