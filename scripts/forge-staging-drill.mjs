import {readFile, writeFile, mkdir} from "node:fs/promises";
import {spawnSync} from "node:child_process";

if (!process.argv.includes("--confirm-isolated-staging")) {
  throw new Error("pass --confirm-isolated-staging to run the Forge staging drill");
}

const staging = new URL("../staging-plane/", import.meta.url);
const envFile = new URL(".env", staging);
const compose = [
  "compose",
  "--env-file",
  envFile.pathname,
  "-f",
  new URL("compose.yml", staging).pathname,
];
const base = "http://127.0.0.1:38700";

function readEnv(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 1) continue;
    result[line.slice(0, index)] = line.slice(index + 1);
  }
  return result;
}

function docker(...args) {
  const result = spawnSync("docker", [...compose, ...args], {
    stdio: "inherit",
    timeout: 60000,
  });
  if (result.error?.code === "ENOENT") throw new Error("docker_is_required_on_the_target_host");
  if (result.status !== 0) throw new Error("docker_compose_failed:" + args.join("_"));
}

async function waitForForge(timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "unavailable";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(base + "/health");
      if (response.ok) {
        const body = await response.json();
        if (body.ok === true) return body;
        lastError = "health_not_ok";
      } else {
        lastError = "http_" + response.status;
      }
    } catch (error) {
      lastError = error?.message ?? "fetch_failed";
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("forge_health_timeout:" + lastError);
}

async function operatorRequest(path, token, options = {}) {
  const response = await fetch(base + path, {
    method: options.method ?? "GET",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error("forge_request_failed:" + response.status + ":" + (body.error ?? "unknown"));
  }
  return body;
}

const env = readEnv(await readFile(envFile, "utf8"));
const token = env.HERCULES_FORGE_STAGING_CONTROL_TOKEN;
if (!token || token.length < 32) throw new Error("forge_staging_control_token_missing");

const before = await waitForForge();
if (!/^\d+\.\d+$/.test(String(before.version))) throw new Error("unexpected_forge_version:" + before.version);
if (before.auditEvents !== true) throw new Error("forge_audit_events_unavailable");
if (before.mode !== "production") throw new Error("forge_not_in_production_mode");
if (before.publicOrigin !== "https://forge.staging.invalid") {
  throw new Error("unexpected_forge_public_origin");
}

const projectId = "forge-staging-" + Date.now().toString(36);
const spec = {
  version: "0.1",
  name: "ForgeStagingPersistence",
  description: "Synthetic Forge staging persistence drill.",
  entities: [
    {name: "Probe", fields: [{name: "value", type: "string", required: true}]},
  ],
  pages: [{name: "Probes", kind: "list", entity: "Probe"}],
  actions: [{name: "CreateProbe", kind: "create", entity: "Probe"}],
};

const created = await operatorRequest("/v1/projects", token, {
  method: "POST",
  body: {
    spec,
    metadata: {
      projectId,
      synthetic: true,
      source: "forge-staging-drill",
    },
  },
});
if (created.project.projectId !== projectId) throw new Error("project_create_identity_mismatch");

const snapshot = await operatorRequest(
  "/v1/projects/" + encodeURIComponent(projectId) + "/data/snapshots",
  token,
  {method: "POST"},
);
if (!snapshot.snapshot?.verified) throw new Error("snapshot_not_verified");
const snapshotId = snapshot.snapshot.snapshotId;

docker("restart", "forge");
const after = await waitForForge();
if (after.mode !== "production") throw new Error("forge_mode_changed_after_restart");

const projects = await operatorRequest("/v1/projects", token);
if (!projects.projects.some((project) => project.projectId === projectId)) {
  throw new Error("forge_project_not_persistent_after_restart");
}

const snapshots = await operatorRequest(
  "/v1/projects/" + encodeURIComponent(projectId) + "/data/snapshots",
  token,
);
if (!snapshots.snapshots.some((item) => item.snapshotId === snapshotId)) {
  throw new Error("forge_snapshot_not_persistent_after_restart");
}

const auditIntegrity = await operatorRequest("/v1/audit/verify", token);
if (!auditIntegrity.integrity?.verified) throw new Error("forge_audit_chain_not_verified");
const auditEvents = await operatorRequest(
  "/v1/audit?projectId=" + encodeURIComponent(projectId) + "&limit=100",
  token,
);
const auditTypes = new Set(auditEvents.events.map((event) => event.type));
if (!auditTypes.has("project.create")) throw new Error("forge_project_audit_missing");
if (!auditTypes.has("data.snapshot")) throw new Error("forge_snapshot_audit_missing");

const evidence = {
  schema: "sauceapproved.hercules.forge-staging-drill",
  version: 1,
  capturedAt: new Date().toISOString(),
  serviceVersion: after.version,
  mode: after.mode,
  publicOrigin: after.publicOrigin,
  projectId,
  projectPersistedAfterRestart: true,
  snapshotId,
  snapshotPersistedAfterRestart: true,
  runtimeDataControl: after.runtimeDataControl === true,
  persistentRuntime: after.persistentRuntime === true,
  auditEvents: after.auditEvents === true,
  auditChainVerifiedAfterRestart: auditIntegrity.integrity.verified === true,
  projectAuditPersistedAfterRestart: auditTypes.has("project.create"),
  snapshotAuditPersistedAfterRestart: auditTypes.has("data.snapshot"),
  controlTokenExposed: false,
};

const output = new URL("../benchmarks/performance/forge-staging-drill.json", import.meta.url);
await mkdir(new URL("./", output), {recursive: true});
await writeFile(output, JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify(evidence, null, 2));
