import http from "node:http";
import {timingSafeEqual} from "node:crypto";
import {join} from "node:path";
import {ForgeWorkspaceStore} from "./workspace.mjs";
import {buildForgeArtifact} from "./artifact.mjs";
import {ForgeLocalReleaseAdapter} from "./releases.mjs";

const MAX_BODY_BYTES = 1024 * 1024;

function sendJson(res, status, body) {
  res.writeHead(status, {"content-type": "application/json; charset=utf-8"});
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      const error = new Error("request body too large");
      error.statusCode = 413;
      throw error;
    }
  }
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("invalid JSON body");
    error.statusCode = 400;
    throw error;
  }
}

function authorized(req, token) {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function routeParts(url) {
  return url.pathname.split("/").filter(Boolean);
}

function fail(res, error) {
  const status = error?.statusCode ??
    (error?.code === "ENOENT" ? 404 : 500);
  const body = {
    error: status >= 500 ? "internal_error" : "request_error",
    message: error?.message ?? "unknown error",
  };
  sendJson(res, status, body);
}

export function createForgeControlServer({
  root,
  operatorToken = process.env.FORGE_OPERATOR_TOKEN,
} = {}) {
  if (!root) throw new Error("Forge control API requires a workspace root");
  if (!operatorToken) throw new Error("Forge control API requires FORGE_OPERATOR_TOKEN");

  const store = new ForgeWorkspaceStore(root);
  const releases = new ForgeLocalReleaseAdapter(root);
  const artifactRoot = join(root, "artifacts");

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");

      if (req.method === "GET" && url.pathname === "/health") {
        return sendJson(res, 200, {
          ok: true,
          service: "hercules-forge-control-api",
          version: "0.4",
        });
      }

      if (!authorized(req, operatorToken)) {
        return sendJson(res, 401, {error: "unauthorized"});
      }

      const parts = routeParts(url);
      if (parts[0] !== "v1" || parts[1] !== "projects") {
        return sendJson(res, 404, {error: "not_found"});
      }

      if (req.method === "POST" && parts.length === 2) {
        const body = await readJson(req);
        const created = await store.createProject(body.spec, body.metadata ?? {});
        return sendJson(res, 201, created);
      }

      const projectId = parts[2];
      if (!projectId) return sendJson(res, 404, {error: "not_found"});

      if (req.method === "GET" && parts.length === 3) {
        return sendJson(res, 200, await store.getProject(projectId));
      }

      if (parts[3] === "revisions") {
        if (req.method === "GET" && parts.length === 4) {
          return sendJson(res, 200, {
            projectId,
            revisions: await store.listRevisions(projectId),
          });
        }

        if (req.method === "POST" && parts.length === 4) {
          const body = await readJson(req);
          const revision = await store.saveRevision(projectId, body.spec, {
            message: body.message ?? null,
          });
          return sendJson(res, 201, revision);
        }

        const revisionId = parts[4];
        if (!revisionId) return sendJson(res, 404, {error: "not_found"});

        if (req.method === "GET" && parts.length === 5) {
          return sendJson(res, 200, await store.getRevision(projectId, revisionId));
        }

        if (req.method === "POST" && parts[5] === "artifact" && parts.length === 6) {
          const built = await buildForgeArtifact({
            workspaceRoot: root,
            artifactRoot,
            projectId,
            revisionId,
          });
          return sendJson(res, 201, built.manifest);
        }

        if (req.method === "POST" && parts[5] === "publish" && parts.length === 6) {
          const revision = await store.getRevision(projectId, revisionId);
          const built = await buildForgeArtifact({
            workspaceRoot: root,
            artifactRoot,
            projectId,
            revisionId,
          });
          const release = await releases.publish({
            projectId,
            revision,
            artifactDir: built.artifactDir,
          });
          return sendJson(res, 201, release);
        }
      }

      if (parts[3] === "releases") {
        if (req.method === "GET" && parts[4] === "active" && parts.length === 5) {
          return sendJson(res, 200, await releases.getActive(projectId));
        }

        if (
          req.method === "POST" &&
          parts[5] === "rollback" &&
          parts.length === 6
        ) {
          const revisionId = parts[4];
          const release = await releases.rollback({projectId, revisionId});
          return sendJson(res, 200, release);
        }
      }

      return sendJson(res, 404, {error: "not_found"});
    } catch (error) {
      return fail(res, error);
    }
  });
}
