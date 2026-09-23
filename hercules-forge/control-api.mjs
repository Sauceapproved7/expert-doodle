import {createHash, timingSafeEqual} from "node:crypto";
import http from "node:http";
import {join} from "node:path";
import {ForgeWorkspaceStore} from "./workspace.mjs";
import {buildForgeArtifact} from "./artifact.mjs";
import {ForgeLocalReleaseAdapter} from "./releases.mjs";
import {ForgePreviewManager} from "./preview.mjs";

const MAX_BODY_BYTES = 1024 * 1024;
const promptHash = (prompt) => createHash("sha256").update(prompt).digest("hex");

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
  return url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
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

export function createForgeControlService({root, token, interpreter = null}) {
  if (!root) throw new TypeError("root is required");
  if (typeof token !== "string" || token.length < 16) {
    throw new TypeError("control token must be at least 16 characters");
  }

  const store = new ForgeWorkspaceStore(root);
  const releases = new ForgeLocalReleaseAdapter(root);
  const previews = new ForgePreviewManager(root);
  const artifactRoot = join(root, "artifacts");

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const parts = routeParts(url);

      if (req.method === "GET" && url.pathname === "/health") {
        return send(res, 200, {
          ok: true,
          service: "hercules-forge-control-api",
          version: "0.6",
          promptIngress: Boolean(interpreter),
          preview: true,
        });
      }

      requireToken(req, token);

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
        return send(res, 201, result);
      }

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
          return send(res, 201, revision);
        }

        if (req.method === "GET" && parts[3] === "revisions" && parts.length === 4) {
          return send(res, 200, {revisions: await store.listRevisions(projectId)});
        }

        if (req.method === "POST" && parts[3] === "revisions" && parts.length === 4) {
          const body = await readBody(req);
          const revision = await store.saveRevision(projectId, body.spec, {message: body.message});
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
          return send(res, 201, {
            preview: await previews.start(projectId, parts[4]),
          });
        }

        if (req.method === "GET" && parts[3] === "preview" && parts.length === 4) {
          const preview = previews.get(projectId);
          return preview
            ? send(res, 200, {preview})
            : send(res, 404, {error: "preview_not_running"});
        }

        if (req.method === "DELETE" && parts[3] === "preview" && parts.length === 4) {
          const stopped = await previews.stop(projectId);
          return send(res, stopped ? 200 : 404, {stopped});
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
          return send(res, 200, await releases.rollback({
            projectId,
            revisionId: body.revisionId,
          }));
        }
      }

      return send(res, 404, {error: "not_found"});
    } catch (error) {
      const status = errorStatus(error);
      return send(res, status, {
        error: status >= 500 ? "internal_error" : error.message,
      });
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
  host = "127.0.0.1",
  port = 38700,
}) {
  const server = createForgeControlService({root, token, interpreter});
  server.listen(port, host);
  return server;
}
