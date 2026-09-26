const SIMPLE_NAME = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;

function normalizeHttpsOrigin(value) {
  let url;
  try {
    url = new URL(String(value ?? ""));
  } catch {
    throw new TypeError("deployment origin must be a valid URL");
  }
  if (url.protocol !== "https:") throw new TypeError("deployment origin must use https");
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new TypeError("deployment origin must be an HTTPS origin without credentials, path, query, or fragment");
  }
  return url.origin;
}

function assertAbsoluteSafePath(label, value) {
  const path = String(value ?? "");
  if (!path.startsWith("/") || /[\r\n\t ]/.test(path)) {
    throw new TypeError(label + " must be an absolute path without whitespace");
  }
  return path;
}

function assertServiceIdentity(label, value) {
  const normalized = String(value ?? "");
  if (!SIMPLE_NAME.test(normalized)) throw new TypeError(label + " is invalid");
  return normalized;
}

async function fetchJson(url, {fetchImpl, timeoutMs}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
      headers: {accept: "application/json"},
    });
    if (!response.ok) throw new Error("deployment probe failed with status " + response.status);
    const contentType = response.headers?.get?.("content-type") ?? "";
    if (!/application\/json/i.test(contentType)) {
      throw new Error("deployment probe did not return JSON");
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyForgePublicDeployment({
  origin,
  expectedVersion = "1.6",
  fetchImpl = globalThis.fetch,
  timeoutMs = 10_000,
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000) {
    throw new TypeError("timeoutMs must be between 1 and 120000");
  }
  const normalizedOrigin = normalizeHttpsOrigin(origin);
  const [health, readiness] = await Promise.all([
    fetchJson(normalizedOrigin + "/health", {fetchImpl, timeoutMs}),
    fetchJson(normalizedOrigin + "/ready", {fetchImpl, timeoutMs}),
  ]);

  if (health.ok !== true) throw new Error("Forge health did not report ok");
  if (health.mode !== "production") throw new Error("Forge health is not production mode");
  if (health.version !== expectedVersion) throw new Error("Forge health version mismatch");
  if (health.publicOrigin !== normalizedOrigin) throw new Error("Forge public origin mismatch");
  if (readiness.ready !== true) throw new Error("Forge readiness did not report ready");
  if (readiness.mode !== "production") throw new Error("Forge readiness is not production mode");
  if (readiness.version !== expectedVersion) throw new Error("Forge readiness version mismatch");
  if (readiness.publicOrigin !== normalizedOrigin) throw new Error("Forge readiness public origin mismatch");
  if (readiness.auditVerified !== true) throw new Error("Forge audit chain is not verified");
  if (!readiness.storage?.writable) throw new Error("Forge storage is not writable");

  return {
    schema: "sauceapproved.hercules.forge.public-deployment-evidence",
    version: 1,
    checkedAt: new Date().toISOString(),
    origin: normalizedOrigin,
    forgeVersion: expectedVersion,
    productionMode: true,
    healthOk: true,
    ready: true,
    auditVerified: true,
    storageWritable: true,
    storageFreeBytes: readiness.storage.freeBytes,
    storageMinFreeBytes: readiness.storage.minFreeBytes,
  };
}

export function renderForgeSystemdUnit({
  workingDirectory,
  forgeRoot,
  environmentFile = "/etc/hercules-forge.env",
  nodePath = "/usr/bin/node",
  user = "hercules-forge",
  group = user,
} = {}) {
  workingDirectory = assertAbsoluteSafePath("workingDirectory", workingDirectory);
  forgeRoot = assertAbsoluteSafePath("forgeRoot", forgeRoot);
  environmentFile = assertAbsoluteSafePath("environmentFile", environmentFile);
  nodePath = assertAbsoluteSafePath("nodePath", nodePath);
  user = assertServiceIdentity("user", user);
  group = assertServiceIdentity("group", group);

  return `[Unit]
Description=Hercules Forge Production Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${user}
Group=${group}
WorkingDirectory=${workingDirectory}
EnvironmentFile=${environmentFile}
ExecStart=${nodePath} ${workingDirectory}/hercules-forge/production-cli.mjs
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true
CapabilityBoundingSet=
ReadWritePaths=${forgeRoot}

[Install]
WantedBy=multi-user.target
`;
}

export {normalizeHttpsOrigin};
