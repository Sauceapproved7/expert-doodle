import {randomBytes} from "node:crypto";
import {mkdir, readFile, stat, writeFile} from "node:fs/promises";
import {dirname, join} from "node:path";
import {ForgeIdentityStore, normalizeEmail} from "./identity.mjs";

const DEFAULT_WORKSPACE_ID = "owner-workspace";
const DEFAULT_WORKSPACE_NAME = "Hercules Workspace";

async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export function controlTokenPath(root) {
  return join(root, "secrets", "control-token");
}

export async function ensureForgeControlToken(root, providedToken = null) {
  if (!root) throw new TypeError("root is required");
  if (providedToken !== null && providedToken !== undefined) {
    if (typeof providedToken !== "string" || providedToken.length < 16) {
      throw new TypeError("control token must be at least 16 characters");
    }
    return {
      token: providedToken,
      source: "environment",
      path: null,
      created: false,
    };
  }

  const path = controlTokenPath(root);
  const existing = (await readOptional(path))?.trim();
  if (existing) {
    if (existing.length < 16) throw new Error("persisted control token is invalid");
    return {token: existing, source: "file", path, created: false};
  }

  await mkdir(dirname(path), {recursive: true, mode: 0o700});
  const generated = randomBytes(32).toString("base64url");
  try {
    await writeFile(path, generated + "\n", {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    return {token: generated, source: "file", path, created: true};
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const raced = (await readOptional(path))?.trim();
    if (!raced || raced.length < 16) throw new Error("persisted control token is invalid");
    return {token: raced, source: "file", path, created: false};
  }
}

export async function inspectControlTokenPermissions(root) {
  const path = controlTokenPath(root);
  const info = await stat(path);
  return {
    path,
    mode: info.mode & 0o777,
    ownerOnly: (info.mode & 0o077) === 0,
  };
}

export async function bootstrapForgeOwner({
  root,
  email = null,
  password = null,
  workspaceId = DEFAULT_WORKSPACE_ID,
  workspaceName = DEFAULT_WORKSPACE_NAME,
} = {}) {
  if (!root) throw new TypeError("root is required");
  const hasEmail = typeof email === "string" && email.trim().length > 0;
  const hasPassword = typeof password === "string" && password.length > 0;

  if (!hasEmail && !hasPassword) {
    return {configured: false, createdUser: false, createdWorkspace: false};
  }
  if (!hasEmail || !hasPassword) {
    throw new TypeError("bootstrap email and password must be provided together");
  }

  const identities = new ForgeIdentityStore(root);
  const normalizedEmail = normalizeEmail(email);
  let user;
  let createdUser = false;
  try {
    user = await identities.getUserByEmail(normalizedEmail);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    user = await identities.createUser({
      email: normalizedEmail,
      password,
    });
    createdUser = true;
  }

  let workspace;
  let createdWorkspace = false;
  try {
    workspace = await identities.getWorkspace(workspaceId);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    workspace = await identities.createWorkspace({
      workspaceId,
      name: workspaceName,
      ownerUserId: user.userId,
    });
    createdWorkspace = true;
  }

  const membership = await identities.addMember({
    workspaceId: workspace.workspaceId,
    userId: user.userId,
    role: "owner",
  });

  return {
    configured: true,
    createdUser,
    createdWorkspace,
    user: {
      userId: user.userId,
      email: normalizedEmail,
    },
    workspace,
    membership,
  };
}

export async function prepareForgeFirstRun({
  root,
  controlToken = null,
  bootstrapEmail = null,
  bootstrapPassword = null,
  bootstrapWorkspaceId = DEFAULT_WORKSPACE_ID,
  bootstrapWorkspaceName = DEFAULT_WORKSPACE_NAME,
} = {}) {
  const [control, bootstrap] = await Promise.all([
    ensureForgeControlToken(root, controlToken),
    bootstrapForgeOwner({
      root,
      email: bootstrapEmail,
      password: bootstrapPassword,
      workspaceId: bootstrapWorkspaceId,
      workspaceName: bootstrapWorkspaceName,
    }),
  ]);

  return {
    control,
    bootstrap,
  };
}

export {
  DEFAULT_WORKSPACE_ID,
  DEFAULT_WORKSPACE_NAME,
};
