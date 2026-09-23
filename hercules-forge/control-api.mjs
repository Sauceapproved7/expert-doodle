import http from "node:http";
import {join} from "node:path";
import {ForgeWorkspaceStore} from "./workspace.mjs";
import {buildForgeArtifact} from "./artifact.mjs";
import {ForgeLocalReleaseAdapter} from "./releases.mjs";

const MAX_BODY_BYTES = 1024 * 1024;

function send(res, status, body) {
  res.writeHead(status, {"content-type": "application/json; charset=utf-8"});
  res.end(JSON.stringify(body));
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
  if (req.headers.authorization !== "Bearer " + token) {
    throw Object.assign(new Error("unauthorized"), {statusCode: 401});
  }
}

function routeParts(url) {
  return url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
}

export function createForgeControlService({root, token}) {
  if (!root) throw new TypeError("root is required");
  if (typeof token !== "string" || token.length < 16) {
    throw new TypeError("control token must be at least 16 characters");
  }

  const store = new ForgeWorkspaceStore(root);
  const releases = new ForgeLocalReleaseAdapter(root);
  const artifactRoot = join(root, "artifacts");

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const parts = routeParts(url);

      if (req.method === "GET" && url.pathname === "/health") {
        return send(res, 200, {
          ok: true,
          service: "hercules-forge-control-api",
          version: "0.4",
        });
      }

      requireToken(req, token);

      if (req.method === "POST" && url.pathname === "/v1/projects") {
        const body = await readBody(req);
        const result = await store.createProject(body.spec, body.metadata ?? {});
        return send(res, 201, result);
      }

      if (parts[0] === "v1" && parts[1] === "projects" && parts[2]) {
        const projectId = parts[2];

        if (req.method === "GET" && parts.length === 3) {
          return send(res, 200, await store.getProject(projectId));
        }

        if (req.method === "GET" && parts[3] === "revisions" && parts.length === 4) {
          return send(res, 200, {revisions: await store.listRevisions(projectId)});
        }

        if (req.method === "POST" && parts[3] === "revisions" && parts.length === 4) {
          const body = await readBody(req);
          const revision = await store.saveRevision(projectId, body.spec, {message: body.message});
          return send(res, 201, revision);
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

          return send(res, 201, {release, artifact: artifact.manifest});
        }

        if (req.method === "GET" && parts[3] === "releases" && parts[4] === "active" && parts.length === 5) {
          return send(res, 200, await releases.getActive(projectId));
        }

        if (req.method === "POST" && parts[3] === "rollback" && parts.length === 4) {
          const body = await readBody(req);
          if (!body.revisionId) {
            throw Object.assign(new Error("revisionId is required"), {statusCode: 400});
          }
          return send(res, 200, await releases.rollback({
            projectId,
            revisionId: body.revisionId,
          }));
        }
      }

      return send(res, 404, {error: "not_found"});
    } catch (error) {
      const status = error.statusCode ?? (
        error.code === "ENOENT" ? 404 :
        error.code === "EEXIST" ? 409 :
        400
      );
      return send(res, status, {
        error: error.message,
      });
    }
  });
}

export function listenForgeControlService({
  root,
  token,
  host = "127.0.0.1",
  port = 38700,
}) {
  const server = createForgeControlService({root, token});
  server.listen(port, host);
  return server;
}
