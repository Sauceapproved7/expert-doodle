import {createHash, timingSafeEqual} from "node:crypto";
import http from "node:http";
import {join} from "node:path";
import {ForgeWorkspaceStore} from "./workspace.mjs";
import {buildForgeArtifact} from "./artifact.mjs";
import {ForgeLocalReleaseAdapter} from "./releases.mjs";
import {ForgePreviewManager} from "./preview.mjs";
import {builderConsoleAsset} from "./builder-console.mjs";
import {customerConsoleAsset} from "./customer-console.mjs";
import {ForgeIdentityStore} from "./identity.mjs";
import {DEFAULT_RUNTIME_DATA_MAX_BYTES, ForgeLocalRuntimeDataAdapter} from "./runtime-data.mjs";
import {ForgeAuditStore} from "./audit.mjs";

const MAX_BODY_BYTES = 1024 * 1024;
const promptHash = (prompt) => createHash("sha256").update(prompt).digest("hex");
const emailAuditHash = (email) => createHash("sha256").update(String(email ?? "").trim().toLowerCase()).digest("hex");

function send(res, status, body, headers = {}) {
  res.writeHead(status, {"content-type": "application/json; charset=utf-8", ...headers});
  res.end(JSON.stringify(body));
}

function parseCookies(req) {
  const header = req.headers.cookie ?? "";
  const result = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(value);
    } catch (error) {
      if (!(error instanceof URIError)) throw error;
    }
  }
  return result;
}

function sessionCookie(token, secure = false) {
  return [
    "forge_session=" + encodeURIComponent(token),
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : null,
  ].filter(Boolean).join("; ");
}

function clearSessionCookie(secure = false) {
  return [
    "forge_session=",
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : null,
    "Max-Age=0",
  ].filter(Boolean).join("; ");
}

function requireCsrfHeader(req) {
  const token = req.headers["x-forge-csrf"];
  if (typeof token !== "string" || !token) {
    throw Object.assign(new Error("csrf token required"), {statusCode: 403});
  }
  return token;
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      throw Object.assign(new Error("request body too large"), {statusCode: 413});
    }
  }
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw Object.assign(new Error("invalid JSON body"), {statusCode: 400});
  }
}

function requireToken(req, token) {
  const header = req.headers.authorization ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) {
    throw Object.assign(new Error("unauthorized"), {statusCode: 401});
  }
  const supplied = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(token);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw Object.assign(new Error("unauthorized"), {statusCode: 401});
  }
}

function requireInterpreter(interpreter) {
  if (!interpreter || typeof interpreter.interpret !== "function") {
    throw Object.assign(new Error("prompt interpreter is not configured"), {statusCode: 503});
  }
}

function requirePrompt(body) {
  if (typeof body.prompt !== "string" || !body.prompt.trim()) {
    throw Object.assign(new Error("prompt is required"), {statusCode: 400});
  }
  return body.prompt.trim();
}

function routeParts(url) {
  try {
    return url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch (error) {
    if (error instanceof URIError) {
      throw Object.assign(new Error("malformed path encoding"), {statusCode: 400});
    }
    throw error;
  }
}

async function requireProjectWorkspace(store, projectId, workspaceId) {
  const project = await store.getProject(projectId);
  if (project.metadata?.workspaceId !== workspaceId) {
    throw Object.assign(new Error("project access denied"), {statusCode: 403});
  }
  return project;
}

function errorStatus(error) {
  if (Number.isInteger(error?.statusCode)) return error.statusCode;
  if (error?.code === "ENOENT") return 404;
  if (error?.code === "EEXIST") return 409;
  if (Array.isArray(error?.details)) return 400;
  if (error instanceof TypeError) return 400;
  if (/path-safe identifier/.test(error?.message ?? "")) return 400;
  return 500;
}

export function createForgeControlService({
  root,
  token,
  interpreter = null,
  secureSessionCookies = false,
  runtimeDataMaxBytes = DEFAULT_RUNTIME_DATA_MAX_BYTES,
  loginRateLimiter = null,
  serviceMode = "development",
  publicOrigin = null,
}) {
  if (!root) throw new TypeError("root is required");
  if (typeof token !== "string" || token.length < 16) {
    throw new TypeError("control token must be at least 16 characters");
  }

  const store = new ForgeWorkspaceStore(root);
  const releases = new ForgeLocalReleaseAdapter(root);
  const previews = new ForgePreviewManager(root, {runtimeDataMaxBytes});
  const runtimeData = new ForgeLocalRuntimeDataAdapter(root, {
    maxProjectBytes: runtimeDataMaxBytes,
  });
  const identities = new ForgeIdentityStore(root);
  const audit = new ForgeAuditStore(root);
  const artifactRoot = join(root, "artifacts");

  const server = http.createServer(async (req, res) => {
    // Defense-in-depth headers apply to every Forge response. TLS terminators
    // may add stricter edge policy, but the application should fail safe when
    // deployed behind a transparent proxy.
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("referrer-policy", "no-referrer");
    res.setHeader("x-frame-options", "DENY");
    res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    if (serviceMode === "production") {
      res.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");
    }

    try {
      const url = new URL(req.url, "http://localhost");
      const parts = routeParts(url);

      if (req.method === "GET") {
        const asset = customerConsoleAsset(url.pathname) ?? builderConsoleAsset(url.pathname);
        if (asset) {
          res.writeHead(200, {
            "content-type": asset.type,
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
            "referrer-policy": "no-referrer",
          });
          return res.end(asset.body);
        }
      }

      if (req.method === "GET" && url.pathname === "/health") {
        return send(res, 200, {
          ok: true,
          service: "hercules-forge-control-api",
          version: "1.4",
          mode: serviceMode,
          publicOrigin,
          promptIngress: Boolean(interpreter),
          preview: true,
          persistentRuntime: true,
          runtimeDataControl: true,
          auditEvents: true,
          runtimeDataMaxBytes,
        });
      }

      if (req.method === "POST" && url.pathname === "/v1/session") {
        const body = await readBody(req);
        const rateKey = typeof body.email === "string" ? body.email : "<unknown>";
        const emailHash = emailAuditHash(rateKey);
        try {
          loginRateLimiter?.beforeAttempt(rateKey);
        } catch (error) {
          if (error?.statusCode === 429) {
            await audit.append({
              type: "session.login",
              outcome: "blocked",
              actor: {kind: "system"},
              details: {emailHash, reason: "rate_limit"},
            });
          }
          throw error;
        }
        try {
          const result = await identities.createSession({
            email: body.email,
            password: body.password,
          });
          loginRateLimiter?.recordSuccess(rateKey);
          await audit.append({
            type: "session.login",
            outcome: "success",
            actor: {kind: "user", userId: result.user.userId},
            details: {emailHash},
          });
          return send(res, 201, {
            user: result.user,
            session: {
              sessionId: result.session.sessionId,
              expiresAt: result.session.expiresAt,
            },
            csrfToken: result.csrfToken,
          }, {"set-cookie": sessionCookie(result.token, secureSessionCookies)});
        } catch (error) {
          if (error?.statusCode === 401) {
            loginRateLimiter?.recordFailure(rateKey);
            await audit.append({
              type: "session.login",
              outcome: "failure",
              actor: {kind: "system"},
              details: {emailHash, reason: "invalid_credentials"},
            });
          }
          throw error;
        }
      }

      if (req.method === "GET" && url.pathname === "/v1/session/csrf") {
        const sessionToken = parseCookies(req).forge_session;
        const rotated = await identities.rotateCsrf(sessionToken);
        return send(res, 200, {
          csrfToken: rotated.csrfToken,
          session: {
            sessionId: rotated.session.sessionId,
            expiresAt: rotated.session.expiresAt,
          },
        });
      }

      if (url.pathname === "/v1/me") {
        const sessionToken = parseCookies(req).forge_session;
        const auth = await identities.getSession(sessionToken);
        if (req.method === "GET") {
          return send(res, 200, {
            user: auth.user,
            workspaces: await identities.listUserWorkspaces(auth.user.userId),
          });
        }
      }

      if (req.method === "DELETE" && url.pathname === "/v1/session") {
        const sessionToken = parseCookies(req).forge_session;
        const auth = await identities.requireCsrf(sessionToken, requireCsrfHeader(req));
        await identities.revokeSession(sessionToken);
        await audit.append({
          type: "session.logout",
          actor: {kind: "user", userId: auth.user.userId},
        });
        return send(res, 200, {revoked: true}, {
          "set-cookie": clearSessionCookie(secureSessionCookies),
        });
      }

      if (parts[0] === "v1" && parts[1] === "workspaces" && parts[2]) {
        const workspaceId = parts[2];
        const sessionToken = parseCookies(req).forge_session;

        if (req.method === "GET" && parts[3] === "audit" && parts.length === 4) {
          await identities.requireWorkspace(sessionToken, workspaceId, ["owner", "admin"]);
          const integrity = await audit.verify();
          const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : 100;
          return send(res, 200, {
            integrity: {verified: integrity.verified},
            events: await audit.list({
              limit,
              workspaceId,
              projectId: url.searchParams.get("projectId"),
              type: url.searchParams.get("type"),
            }),
          });
        }

        if (req.method === "GET" && parts.length === 3) {
          const auth = await identities.requireWorkspace(sessionToken, workspaceId);
          return send(res, 200, {
            workspace: auth.workspace,
            membership: auth.membership,
          });
        }

        if (req.method === "GET" && parts[3] === "projects" && parts.length === 4) {
          const auth = await identities.requireWorkspace(sessionToken, workspaceId);
          return send(res, 200, {
            workspace: auth.workspace,
            membership: auth.membership,
            projects: await store.listProjects({workspaceId}),
          });
        }

        if (req.method === "POST" && parts[3] === "projects" && parts[4] === "from-prompt" && parts.length === 5) {
          requireInterpreter(interpreter);
          await identities.requireCsrf(sessionToken, requireCsrfHeader(req));
          const auth = await identities.requireWorkspace(sessionToken, workspaceId, ["owner", "admin", "builder"]);
          const body = await readBody(req);
          const prompt = requirePrompt(body);
          const spec = await interpreter.interpret(prompt);
          const result = await store.createProject(spec, {
            ...(body.metadata ?? {}),
            workspaceId,
            createdByUserId: auth.user.userId,
            source: "prompt",
            promptSha256: promptHash(prompt),
          });
          await audit.append({
            type: "project.create",
            actor: {kind: "user", userId: auth.user.userId},
            workspaceId,
            projectId: result.project.projectId,
            details: {revisionId: result.revision.revisionId, source: "prompt"},
          });
          return send(res, 201, result);
        }

        if (parts[3] === "projects" && parts[4]) {
          const projectId = parts[4];

          if (req.method === "GET" && parts.length === 5) {
            await identities.requireWorkspace(sessionToken, workspaceId);
            return send(res, 200, await requireProjectWorkspace(store, projectId, workspaceId));
          }

          if (req.method === "GET" && parts[5] === "revisions" && parts.length === 6) {
            await identities.requireWorkspace(sessionToken, workspaceId);
            await requireProjectWorkspace(store, projectId, workspaceId);
            return send(res, 200, {revisions: await store.listRevisions(projectId)});
          }

          if (req.method === "POST" && parts[5] === "revisions" && parts[6] === "from-prompt" && parts.length === 7) {
            requireInterpreter(interpreter);
            await identities.requireCsrf(sessionToken, requireCsrfHeader(req));
            const auth = await identities.requireWorkspace(sessionToken, workspaceId, ["owner", "admin", "builder"]);
            await requireProjectWorkspace(store, projectId, workspaceId);
            const body = await readBody(req);
            const prompt = requirePrompt(body);
            const spec = await interpreter.interpret(prompt);
            const revision = await store.saveRevision(projectId, spec, {
              message: body.message ?? "Prompt revision " + promptHash(prompt).slice(0, 12),
            });
            await audit.append({
              type: "project.revision",
              actor: {kind: "user", userId: auth.user.userId},
              workspaceId,
              projectId,
              details: {revisionId: revision.revisionId, source: "prompt"},
            });
            return send(res, 201, revision);
          }

          if (req.method === "POST" && parts[5] === "revisions" && parts[6] && parts[7] === "preview" && parts.length === 8) {
            await identities.requireCsrf(sessionToken, requireCsrfHeader(req));
            const auth = await identities.requireWorkspace(sessionToken, workspaceId, ["owner", "admin", "builder"]);
            await requireProjectWorkspace(store, projectId, workspaceId);
            await store.getRevision(projectId, parts[6]);
            const preview = await previews.start(projectId, parts[6]);
            await audit.append({
              type: "preview.start",
              actor: {kind: "user", userId: auth.user.userId},
              workspaceId,
              projectId,
              details: {revisionId: parts[6]},
            });
            return send(res, 201, {preview});
          }

          if (req.method === "GET" && parts[5] === "preview" && parts.length === 6) {
            await identities.requireWorkspace(sessionToken, workspaceId);
            await requireProjectWorkspace(store, projectId, workspaceId);
            const preview = previews.get(projectId);
            return preview ? send(res, 200, {preview}) : send(res, 404, {error: "preview_not_running"});
          }

          if (req.method === "DELETE" && parts[5] === "preview" && parts.length === 6) {
            await identities.requireCsrf(sessionToken, requireCsrfHeader(req));
            const auth = await identities.requireWorkspace(sessionToken, workspaceId, ["owner", "admin", "builder"]);
            await requireProjectWorkspace(store, projectId, workspaceId);
            const stopped = await previews.stop(projectId);
            if (stopped) {
              await audit.append({
                type: "preview.stop",
                actor: {kind: "user", userId: auth.user.userId},
                workspaceId,
                projectId,
              });
            }
            return send(res, stopped ? 200 : 404, {stopped});
          }

          if (req.method === "GET" && parts[5] === "data" && parts[6] === "usage" && parts.length === 7) {
            await identities.requireWorkspace(sessionToken, workspaceId);
            await requireProjectWorkspace(store, projectId, workspaceId);
            return send(res, 200, {usage: await runtimeData.usage(projectId)});
          }

          if (req.method === "GET" && parts[5] === "data" && parts[6] === "snapshots" && parts.length === 7) {
            await identities.requireWorkspace(sessionToken, workspaceId);
            await requireProjectWorkspace(store, projectId, workspaceId);
            return send(res, 200, {snapshots: await runtimeData.listSnapshots(projectId)});
          }

          if (
            req.method === "GET" &&
            parts[5] === "data" &&
            parts[6] === "snapshots" &&
            parts[7] &&
            parts.length === 8
          ) {
            await identities.requireWorkspace(sessionToken, workspaceId);
            await requireProjectWorkspace(store, projectId, workspaceId);
            return send(res, 200, {
              snapshot: await runtimeData.verifySnapshot(projectId, parts[7]),
            });
          }

          if (req.method === "POST" && parts[5] === "data" && parts[6] === "snapshots" && parts.length === 7) {
            await identities.requireCsrf(sessionToken, requireCsrfHeader(req));
            const auth = await identities.requireWorkspace(sessionToken, workspaceId, ["owner", "admin", "builder"]);
            await requireProjectWorkspace(store, projectId, workspaceId);
            await previews.stop(projectId);
            const snapshot = await runtimeData.createSnapshot(projectId);
            await audit.append({
              type: "data.snapshot",
              actor: {kind: "user", userId: auth.user.userId},
              workspaceId,
              projectId,
              details: {snapshotId: snapshot.snapshotId, totalBytes: snapshot.totalBytes},
            });
            return send(res, 201, {snapshot});
          }

          if (
            req.method === "POST" &&
            parts[5] === "data" &&
            parts[6] === "snapshots" &&
            parts[7] &&
            parts[8] === "restore" &&
            parts.length === 9
          ) {
            await identities.requireCsrf(sessionToken, requireCsrfHeader(req));
            const auth = await identities.requireWorkspace(sessionToken, workspaceId, ["owner", "admin"]);
            await requireProjectWorkspace(store, projectId, workspaceId);
            await previews.stop(projectId);
            const restore = await runtimeData.restoreSnapshot(projectId, parts[7]);
            await audit.append({
              type: "data.restore",
              actor: {kind: "user", userId: auth.user.userId},
              workspaceId,
              projectId,
              details: {snapshotId: parts[7]},
            });
            return send(res, 200, {restore});
          }

          if (req.method === "POST" && parts[5] === "publish" && parts.length === 6) {
            await identities.requireCsrf(sessionToken, requireCsrfHeader(req));
            const auth = await identities.requireWorkspace(sessionToken, workspaceId, ["owner", "admin"]);
            await requireProjectWorkspace(store, projectId, workspaceId);
            const body = await readBody(req);
            const revision = body.revisionId
              ? await store.getRevision(projectId, body.revisionId)
              : await store.getLatestRevision(projectId);
            const artifact = await buildForgeArtifact({
              workspaceRoot: root,
              artifactRoot,
              projectId,
              revisionId: revision.revisionId,
            });
            const release = await releases.publish({
              projectId,
              revision,
              artifactDir: artifact.artifactDir,
            });
            await audit.append({
              type: "project.publish",
              actor: {kind: "user", userId: auth.user.userId},
              workspaceId,
              projectId,
              details: {
                revisionId: revision.revisionId,
                releaseId: release.releaseId ?? null,
              },
            });
            return send(res, 201, {release, artifact: artifact.manifest});
          }

          if (req.method === "POST" && parts[5] === "rollback" && parts.length === 6) {
            await identities.requireCsrf(sessionToken, requireCsrfHeader(req));
            const auth = await identities.requireWorkspace(sessionToken, workspaceId, ["owner", "admin"]);
            await requireProjectWorkspace(store, projectId, workspaceId);
            const body = await readBody(req);
            if (!body.revisionId) {
              throw Object.assign(new Error("revisionId is required"), {statusCode: 400});
            }
            const rollback = await releases.rollback({projectId, revisionId: body.revisionId});
            await audit.append({
              type: "project.rollback",
              actor: {kind: "user", userId: auth.user.userId},
              workspaceId,
              projectId,
              details: {revisionId: body.revisionId},
            });
            return send(res, 200, rollback);
          }
        }
      }

      requireToken(req, token);

      if (req.method === "GET" && url.pathname === "/v1/audit/verify") {
        return send(res, 200, {integrity: await audit.verify()});
      }

      if (req.method === "GET" && url.pathname === "/v1/audit") {
        const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : 100;
        return send(res, 200, {
          events: await audit.list({
            limit,
            workspaceId: url.searchParams.get("workspaceId"),
            projectId: url.searchParams.get("projectId"),
            type: url.searchParams.get("type"),
          }),
        });
      }

      if (req.method === "POST" && url.pathname === "/v1/admin/users") {
        const body = await readBody(req);
        const user = await identities.createUser(body);
        await audit.append({
          type: "admin.user.create",
          actor: {kind: "control"},
          details: {userId: user.userId},
        });
        return send(res, 201, {user});
      }

      if (req.method === "POST" && url.pathname === "/v1/admin/workspaces") {
        const body = await readBody(req);
        const workspace = await identities.createWorkspace(body);
        await audit.append({
          type: "admin.workspace.create",
          actor: {kind: "control"},
          workspaceId: workspace.workspaceId,
          details: {ownerUserId: workspace.ownerUserId},
        });
        return send(res, 201, {workspace});
      }

      if (
        req.method === "POST" &&
        parts[0] === "v1" &&
        parts[1] === "admin" &&
        parts[2] === "workspaces" &&
        parts[3] &&
        parts[4] === "members" &&
        parts.length === 5
      ) {
        const body = await readBody(req);
        const membership = await identities.addMember({
          workspaceId: parts[3],
          userId: body.userId,
          role: body.role,
        });
        await audit.append({
          type: "admin.member.add",
          actor: {kind: "control"},
          workspaceId: parts[3],
          details: {userId: membership.userId, role: membership.role},
        });
        return send(res, 201, {membership});
      }

      if (req.method === "GET" && url.pathname === "/v1/projects") {
        return send(res, 200, {projects: await store.listProjects()});
      }

      if (req.method === "POST" && url.pathname === "/v1/projects/from-prompt") {
        requireInterpreter(interpreter);
        const body = await readBody(req);
        const prompt = requirePrompt(body);
        const spec = await interpreter.interpret(prompt);
        const metadata = {
          ...(body.metadata ?? {}),
          source: "prompt",
          promptSha256: promptHash(prompt),
        };
        const result = await store.createProject(spec, metadata);
        await audit.append({
          type: "project.create",
          actor: {kind: "control"},
          projectId: result.project.projectId,
          details: {revisionId: result.revision.revisionId, source: "prompt"},
        });
        return send(res, 201, result);
      }

      if (req.method === "POST" && url.pathname === "/v1/projects") {
        const body = await readBody(req);
        const result = await store.createProject(body.spec, body.metadata ?? {});
        await audit.append({
          type: "project.create",
          actor: {kind: "control"},
          projectId: result.project.projectId,
          details: {revisionId: result.revision.revisionId, source: "spec"},
        });
        return send(res, 201, result);
      }

      if (parts[0] === "v1" && parts[1] === "projects" && parts[2]) {
        const projectId = parts[2];

        if (req.method === "GET" && parts.length === 3) {
          return send(res, 200, await store.getProject(projectId));
        }

        if (
          req.method === "POST" &&
          parts[3] === "revisions" &&
          parts[4] === "from-prompt" &&
          parts.length === 5
        ) {
          requireInterpreter(interpreter);
          const body = await readBody(req);
          const prompt = requirePrompt(body);
          const spec = await interpreter.interpret(prompt);
          const revision = await store.saveRevision(projectId, spec, {
            message: body.message ?? "Prompt revision " + promptHash(prompt).slice(0, 12),
          });
          await audit.append({
            type: "project.revision",
            actor: {kind: "control"},
            projectId,
            details: {revisionId: revision.revisionId, source: "prompt"},
          });
          return send(res, 201, revision);
        }

        if (req.method === "GET" && parts[3] === "revisions" && parts.length === 4) {
          return send(res, 200, {revisions: await store.listRevisions(projectId)});
        }

        if (req.method === "POST" && parts[3] === "revisions" && parts.length === 4) {
          const body = await readBody(req);
          const revision = await store.saveRevision(projectId, body.spec, {message: body.message});
          await audit.append({
            type: "project.revision",
            actor: {kind: "control"},
            projectId,
            details: {revisionId: revision.revisionId, source: "spec"},
          });
          return send(res, 201, revision);
        }

        if (
          req.method === "GET" &&
          parts[3] === "revisions" &&
          parts[4] &&
          parts.length === 5
        ) {
          return send(res, 200, await store.getRevision(projectId, parts[4]));
        }

        if (
          req.method === "POST" &&
          parts[3] === "revisions" &&
          parts[4] &&
          parts[5] === "artifact" &&
          parts.length === 6
        ) {
          const revisionId = parts[4];
          await store.getRevision(projectId, revisionId);
          const artifact = await buildForgeArtifact({
            workspaceRoot: root,
            artifactRoot,
            projectId,
            revisionId,
          });
          await audit.append({
            type: "artifact.build",
            actor: {kind: "control"},
            projectId,
            details: {
              revisionId,
              artifactFingerprint: artifact.manifest.artifactFingerprint,
            },
          });
          return send(res, 201, {artifact: artifact.manifest});
        }

        if (
          req.method === "POST" &&
          parts[3] === "revisions" &&
          parts[4] &&
          parts[5] === "preview" &&
          parts.length === 6
        ) {
          await store.getRevision(projectId, parts[4]);
          const preview = await previews.start(projectId, parts[4]);
          await audit.append({
            type: "preview.start",
            actor: {kind: "control"},
            projectId,
            details: {revisionId: parts[4]},
          });
          return send(res, 201, {preview});
        }

        if (req.method === "GET" && parts[3] === "preview" && parts.length === 4) {
          const preview = previews.get(projectId);
          return preview
            ? send(res, 200, {preview})
            : send(res, 404, {error: "preview_not_running"});
        }

        if (req.method === "DELETE" && parts[3] === "preview" && parts.length === 4) {
          const stopped = await previews.stop(projectId);
          if (stopped) {
            await audit.append({
              type: "preview.stop",
              actor: {kind: "control"},
              projectId,
            });
          }
          return send(res, stopped ? 200 : 404, {stopped});
        }

        if (req.method === "GET" && parts[3] === "data" && parts[4] === "usage" && parts.length === 5) {
          await store.getProject(projectId);
          return send(res, 200, {usage: await runtimeData.usage(projectId)});
        }

        if (req.method === "GET" && parts[3] === "data" && parts[4] === "snapshots" && parts.length === 5) {
          await store.getProject(projectId);
          return send(res, 200, {snapshots: await runtimeData.listSnapshots(projectId)});
        }

        if (
          req.method === "GET" &&
          parts[3] === "data" &&
          parts[4] === "snapshots" &&
          parts[5] &&
          parts.length === 6
        ) {
          await store.getProject(projectId);
          return send(res, 200, {
            snapshot: await runtimeData.verifySnapshot(projectId, parts[5]),
          });
        }

        if (req.method === "POST" && parts[3] === "data" && parts[4] === "snapshots" && parts.length === 5) {
          await store.getProject(projectId);
          await previews.stop(projectId);
          const snapshot = await runtimeData.createSnapshot(projectId);
          await audit.append({
            type: "data.snapshot",
            actor: {kind: "control"},
            projectId,
            details: {snapshotId: snapshot.snapshotId, totalBytes: snapshot.totalBytes},
          });
          return send(res, 201, {snapshot});
        }

        if (
          req.method === "POST" &&
          parts[3] === "data" &&
          parts[4] === "snapshots" &&
          parts[5] &&
          parts[6] === "restore" &&
          parts.length === 7
        ) {
          await store.getProject(projectId);
          await previews.stop(projectId);
          const restore = await runtimeData.restoreSnapshot(projectId, parts[5]);
          await audit.append({
            type: "data.restore",
            actor: {kind: "control"},
            projectId,
            details: {snapshotId: parts[5]},
          });
          return send(res, 200, {restore});
        }

        if (req.method === "POST" && parts[3] === "publish" && parts.length === 4) {
          const body = await readBody(req);
          const revision = body.revisionId
            ? await store.getRevision(projectId, body.revisionId)
            : await store.getLatestRevision(projectId);

          const artifact = await buildForgeArtifact({
            workspaceRoot: root,
            artifactRoot,
            projectId,
            revisionId: revision.revisionId,
          });

          const release = await releases.publish({
            projectId,
            revision,
            artifactDir: artifact.artifactDir,
          });
          await audit.append({
            type: "project.publish",
            actor: {kind: "control"},
            projectId,
            details: {
              revisionId: revision.revisionId,
              releaseId: release.releaseId ?? null,
            },
          });

          return send(res, 201, {release, artifact: artifact.manifest});
        }

        if (
          req.method === "GET" &&
          parts[3] === "releases" &&
          parts[4] === "active" &&
          parts.length === 5
        ) {
          return send(res, 200, await releases.getActive(projectId));
        }

        if (req.method === "POST" && parts[3] === "rollback" && parts.length === 4) {
          const body = await readBody(req);
          if (!body.revisionId) {
            throw Object.assign(new Error("revisionId is required"), {statusCode: 400});
          }
          const rollback = await releases.rollback({
            projectId,
            revisionId: body.revisionId,
          });
          await audit.append({
            type: "project.rollback",
            actor: {kind: "control"},
            projectId,
            details: {revisionId: body.revisionId},
          });
          return send(res, 200, rollback);
        }
      }

      return send(res, 404, {error: "not_found"});
    } catch (error) {
      const status = errorStatus(error);
      const headers = error?.retryAfterSeconds
        ? {"retry-after": String(error.retryAfterSeconds)}
        : {};
      return send(res, status, {
        error: status >= 500 ? "internal_error" : error.message,
      }, headers);
    }
  });

  server.on("close", () => {
    void previews.stopAll();
  });

  return server;
}

export function listenForgeControlService({
  root,
  token,
  interpreter = null,
  secureSessionCookies = false,
  runtimeDataMaxBytes = DEFAULT_RUNTIME_DATA_MAX_BYTES,
  loginRateLimiter = null,
  serviceMode = "development",
  publicOrigin = null,
  host = "127.0.0.1",
  port = 38700,
}) {
  const server = createForgeControlService({
    root,
    token,
    interpreter,
    secureSessionCookies,
    runtimeDataMaxBytes,
    loginRateLimiter,
    serviceMode,
    publicOrigin,
  });
  server.listen(port, host);
  return server;
}
