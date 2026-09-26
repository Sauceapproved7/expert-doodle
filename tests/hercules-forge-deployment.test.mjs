import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {mkdtemp, readdir, rm} from "node:fs/promises";
import net from "node:net";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
  preflightForgeProduction,
  startForgeProductionService,
} from "../hercules-forge/production.mjs";
import {
  renderForgeSystemdUnit,
  verifyForgePublicDeployment,
} from "../hercules-forge/deployment.mjs";

function runtimeSecret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function productionEnv(root, port) {
  return {
    FORGE_ROOT: root,
    FORGE_CONTROL_TOKEN: runtimeSecret(),
    FORGE_PUBLIC_ORIGIN: "https://forge.example.test",
    FORGE_HOST: "127.0.0.1",
    FORGE_PORT: String(port),
    FORGE_MIN_FREE_BYTES: String(1024 * 1024),
  };
}

test("production preflight proves writable persistent storage and cleans its probe", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-preflight-"));
  try {
    const env = productionEnv(root, await freePort());
    const result = await preflightForgeProduction({env});

    assert.equal(result.storage.writable, true);
    assert.ok(result.storage.freeBytes >= result.storage.minFreeBytes);
    assert.equal(result.storage.minFreeBytes, 1024 * 1024);
    assert.equal(result.summary.storage.writable, true);
    assert.equal(result.summary.minFreeBytes, 1024 * 1024);

    const entries = await readdir(root);
    assert.equal(entries.some((name) => name.startsWith(".forge-storage-probe-")), false);
    assert.equal(JSON.stringify(result.summary).includes(env.FORGE_CONTROL_TOKEN), false);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("production preflight fails closed when the free-space floor cannot be met", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-preflight-space-"));
  try {
    const env = {
      ...productionEnv(root, await freePort()),
      FORGE_MIN_FREE_BYTES: String(Number.MAX_SAFE_INTEGER),
    };
    await assert.rejects(
      preflightForgeProduction({env}),
      /minimum free-space requirement/,
    );
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("production service exposes readiness backed by audit and storage probes", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-ready-"));
  const port = await freePort();
  const env = productionEnv(root, port);
  let service;
  try {
    service = await startForgeProductionService({env});
    const ready = await fetch("http://127.0.0.1:" + port + "/ready");
    assert.equal(ready.status, 200);
    const body = await ready.json();
    assert.equal(body.ready, true);
    assert.equal(body.version, "1.6");
    assert.equal(body.mode, "production");
    assert.equal(body.publicOrigin, "https://forge.example.test");
    assert.equal(body.auditVerified, true);
    assert.equal(body.storage.writable, true);
    assert.ok(body.storage.freeBytes >= body.storage.minFreeBytes);
  } finally {
    if (service) await service.shutdown();
    await rm(root, {recursive: true, force: true});
  }
});

test("public deployment verifier requires matching HTTPS production health and readiness", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({url, options});
    const pathname = new URL(url).pathname;
    const body = pathname === "/health"
      ? {
          ok: true,
          version: "1.6",
          mode: "production",
          publicOrigin: "https://forge.example.test",
        }
      : {
          ready: true,
          version: "1.6",
          mode: "production",
          publicOrigin: "https://forge.example.test",
          auditVerified: true,
          storage: {
            writable: true,
            freeBytes: 500_000_000,
            minFreeBytes: 1_000_000,
          },
        };
    return {
      ok: true,
      status: 200,
      headers: {get: (name) => name.toLowerCase() === "content-type" ? "application/json" : null},
      json: async () => body,
    };
  };

  const evidence = await verifyForgePublicDeployment({
    origin: "https://forge.example.test",
    fetchImpl,
  });
  assert.equal(evidence.healthOk, true);
  assert.equal(evidence.ready, true);
  assert.equal(evidence.auditVerified, true);
  assert.equal(evidence.storageWritable, true);
  assert.equal(calls.length, 2);
  assert.equal(calls.every((call) => call.options.redirect === "error"), true);

  await assert.rejects(
    verifyForgePublicDeployment({
      origin: "http://forge.example.test",
      fetchImpl,
    }),
    /must use https/,
  );
});

test("systemd unit template is restart-safe, hardened, and keeps secrets outside the unit", () => {
  const unit = renderForgeSystemdUnit({
    workingDirectory: "/opt/hercules",
    forgeRoot: "/var/lib/hercules-forge",
    environmentFile: "/etc/hercules-forge.env",
    nodePath: "/usr/bin/node",
    user: "hercules-forge",
  });

  assert.match(unit, /Restart=on-failure/);
  assert.match(unit, /NoNewPrivileges=true/);
  assert.match(unit, /ProtectSystem=strict/);
  assert.match(unit, /UMask=0077/);
  assert.match(unit, /ReadWritePaths=\/var\/lib\/hercules-forge/);
  assert.match(unit, /EnvironmentFile=\/etc\/hercules-forge\.env/);
  assert.match(unit, /ExecStart=\/usr\/bin\/node \/opt\/hercules\/hercules-forge\/production-cli\.mjs/);
  assert.equal(unit.includes("FORGE_CONTROL_TOKEN"), false);
  assert.equal(unit.includes("FORGE_NOTIFICATION_TOKEN"), false);

  assert.throws(
    () => renderForgeSystemdUnit({
      workingDirectory: "/opt/hercules with-space",
      forgeRoot: "/var/lib/hercules-forge",
    }),
    /without whitespace/,
  );
});
