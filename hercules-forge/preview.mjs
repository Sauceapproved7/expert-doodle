import http from "node:http";
import {fork} from "node:child_process";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {verifyForgeArtifact, buildForgeArtifact} from "./artifact.mjs";

const MAX_PROXY_BODY_BYTES = 1024 * 1024;
const START_TIMEOUT_MS = 10000;

export function buildPreviewChildEnv(source = process.env) {
  const allowed = [
    "PATH",
    "SystemRoot",
    "WINDIR",
    "TEMP",
    "TMP",
    "TMPDIR",
    "HOME",
    "USERPROFILE",
    "LANG",
    "LC_ALL",
  ];
  const env = {};
  for (const name of allowed) {
    if (source[name] !== undefined) env[name] = source[name];
  }
  env.NODE_ENV = "preview";
  env.HOST = "127.0.0.1";
  env.PORT = "0";
  return env;
}

async function readBoundedBody(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_PROXY_BODY_BYTES) {
      throw Object.assign(new Error("request body too large"), {statusCode: 413});
    }
    chunks.push(chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : null;
}

function waitForBackend(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("preview backend start timed out"));
    }, START_TIMEOUT_MS);

    const onMessage = (message) => {
      if (message?.type !== "forge-ready" || !message.address?.port) return;
      cleanup();
      resolve(message.address);
    };
    const onExit = (code, signal) => {
      cleanup();
      reject(new Error("preview backend exited before ready: " + (signal ?? code)));
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.off("message", onMessage);
      child.off("exit", onExit);
      child.off("error", onError);
    };

    child.on("message", onMessage);
    child.on("exit", onExit);
    child.on("error", onError);
  });
}

async function closeServer(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    new Promise((resolve) => setTimeout(() => resolve(false), 1500)),
  ]);
  if (!exited && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
  }
}

export async function startForgePreview({artifactDir}) {
  const artifact = await verifyForgeArtifact(artifactDir);
  const bundleRoot = join(artifactDir, "bundle");
  const serverPath = join(bundleRoot, "server.mjs");
  const indexPath = join(bundleRoot, "public", "index.html");

  await readFile(serverPath);
  const indexHtml = await readFile(indexPath);
  const publicAssets = new Map([["/index.html", {type: "text/html; charset=utf-8", body: indexHtml}]]);
  for (const [pathname, filename, type] of [
    ["/app.js", "app.js", "text/javascript; charset=utf-8"],
    ["/app.css", "app.css", "text/css; charset=utf-8"],
  ]) {
    try {
      publicAssets.set(pathname, {
        type,
        body: await readFile(join(bundleRoot, "public", filename)),
      });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const child = fork(serverPath, [], {
    cwd: bundleRoot,
    env: buildPreviewChildEnv(),
    silent: true,
  });

  let backendAddress;
  try {
    backendAddress = await waitForBackend(child);
  } catch (error) {
    await stopChild(child);
    throw error;
  }

  const backendUrl = "http://127.0.0.1:" + backendAddress.port;

  const previewServer = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");

      if (req.method === "GET" && url.pathname === "/") {
        url.pathname = "/index.html";
      }

      if (req.method === "GET" && publicAssets.has(url.pathname)) {
        const asset = publicAssets.get(url.pathname);
        res.writeHead(200, {
          "content-type": asset.type,
          "cache-control": "no-store",
          "content-security-policy":
            "default-src 'self'; connect-src 'self'; img-src 'self' data:; " +
            "style-src 'self'; script-src 'self'; " +
            "base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
          "x-content-type-options": "nosniff",
          "referrer-policy": "no-referrer",
        });
        return res.end(asset.body);
      }

      if (
        url.pathname === "/health" ||
        url.pathname === "/api" ||
        url.pathname.startsWith("/api/")
      ) {
        const body = ["GET", "HEAD"].includes(req.method)
          ? null
          : await readBoundedBody(req);
        const upstream = await fetch(backendUrl + url.pathname + url.search, {
          method: req.method,
          headers: req.headers["content-type"]
            ? {"content-type": req.headers["content-type"]}
            : {},
          body,
          redirect: "error",
        });
        const responseBody = Buffer.from(await upstream.arrayBuffer());
        res.writeHead(upstream.status, {
          "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        });
        return res.end(responseBody);
      }

      res.writeHead(404, {"content-type": "application/json; charset=utf-8"});
      return res.end(JSON.stringify({error: "not_found"}));
    } catch (error) {
      const status = Number.isInteger(error?.statusCode) ? error.statusCode : 502;
      res.writeHead(status, {"content-type": "application/json; charset=utf-8"});
      return res.end(JSON.stringify({
        error: status >= 500 ? "preview_upstream_error" : error.message,
      }));
    }
  });

  await new Promise((resolve, reject) => {
    previewServer.once("error", reject);
    previewServer.listen(0, "127.0.0.1", resolve);
  });

  const previewAddress = previewServer.address();
  const info = {
    projectId: artifact.projectId,
    revisionId: artifact.revisionId,
    revisionFingerprint: artifact.revisionFingerprint,
    artifactFingerprint: artifact.artifactFingerprint,
    url: "http://127.0.0.1:" + previewAddress.port,
    backendUrl,
    isolation: "loopback-controlled-process",
  };

  return {
    ...info,
    async stop() {
      await closeServer(previewServer);
      await stopChild(child);
    },
  };
}

export class ForgePreviewManager {
  constructor(root) {
    this.root = root;
    this.sessions = new Map();
  }

  async start(projectId, revisionId) {
    await this.stop(projectId);

    const built = await buildForgeArtifact({
      workspaceRoot: this.root,
      artifactRoot: join(this.root, "artifacts"),
      projectId,
      revisionId,
    });
    const session = await startForgePreview({artifactDir: built.artifactDir});
    this.sessions.set(projectId, session);
    return this.get(projectId);
  }

  get(projectId) {
    const session = this.sessions.get(projectId);
    if (!session) return null;
    return {
      projectId: session.projectId,
      revisionId: session.revisionId,
      revisionFingerprint: session.revisionFingerprint,
      artifactFingerprint: session.artifactFingerprint,
      url: session.url,
      backendUrl: session.backendUrl,
      isolation: session.isolation,
    };
  }

  async stop(projectId) {
    const session = this.sessions.get(projectId);
    if (!session) return false;
    this.sessions.delete(projectId);
    await session.stop();
    return true;
  }

  async stopAll() {
    const ids = [...this.sessions.keys()];
    for (const projectId of ids) await this.stop(projectId);
  }
}
