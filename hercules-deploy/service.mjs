import {isAbsolute, relative, resolve} from "node:path";
import {listenHerculesDeployService} from "./control-api.mjs";
import {createSupabaseEdgeFunctionAdapterFromEnv} from "./supabase-management.mjs";
import {createMarketing16DeployBridge} from "./marketing-16-bridge.mjs";
import {HerculesBotDeployTargetAdapter} from "./hercules-bot-adapter.mjs";

function required(env, name) {
  const value = env[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(name + " is required");
  }
  return value.trim();
}

function nestedOrSame(parent, child) {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function integer(name, value, min, max) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(name + " must be an integer between " + min + " and " + max);
  }
  return parsed;
}

export function readHerculesDeployConfig(env = process.env) {
  const root = resolve(required(env, "HERCULES_DEPLOY_ROOT"));
  const recoveryRoot = resolve(required(env, "HERCULES_DEPLOY_RECOVERY_ROOT"));
  if (nestedOrSame(root, recoveryRoot) || nestedOrSame(recoveryRoot, root)) {
    throw new Error("HERCULES_DEPLOY_RECOVERY_ROOT must be independent from HERCULES_DEPLOY_ROOT");
  }
  const token = required(env, "HERCULES_DEPLOY_CONTROL_TOKEN");
  if (token.length < 32) {
    throw new Error("HERCULES_DEPLOY_CONTROL_TOKEN must be at least 32 characters");
  }
  return {
    root,
    recoveryRoot,
    token,
    host: String(env.HERCULES_DEPLOY_HOST ?? "127.0.0.1").trim(),
    port: integer("HERCULES_DEPLOY_PORT", env.HERCULES_DEPLOY_PORT ?? 38800, 1, 65535),
    pollIntervalMs: integer(
      "HERCULES_DEPLOY_POLL_MS",
      env.HERCULES_DEPLOY_POLL_MS ?? 1000,
      100,
      60000,
    ),
  };
}

export function safeHerculesDeployConfig(config) {
  return {
    root: config.root,
    recoveryRoot: config.recoveryRoot,
    host: config.host,
    port: config.port,
    pollIntervalMs: config.pollIntervalMs,
  };
}

export function createMarketing16TargetAdapter() {
  const bridge = createMarketing16DeployBridge();
  let active = null;

  return Object.freeze({
    async deploy({deploymentId, request}) {
      const health = bridge.health();
      const plan = bridge.plan({
        brandId: "sauceapproved",
        objective: "operate Marketing 16 through Hercules Deploy",
        evidenceIds: [request.sourceCommit, request.artifactFingerprint],
      });
      if (!health.ok || health.modules !== 16 || plan.releaseReady !== false) {
        throw Object.assign(new Error("marketing runtime safety gate failed"), {
          code: "marketing_runtime_safety_gate_failed",
        });
      }
      active = Object.freeze({
        deploymentId,
        releaseId: request.releaseId,
        sourceCommit: request.sourceCommit,
        artifactFingerprint: request.artifactFingerprint,
      });
      return {
        targetKind: request.target.kind,
        targetReference: request.target.reference,
        releaseId: request.releaseId,
        modules: health.modules,
        releaseReady: plan.releaseReady,
        autoPublish: health.autoPublish,
        autoSpend: health.autoSpend,
        storefrontMutation: health.storefrontMutation,
      };
    },

    async verify({deploymentId, request}) {
      if (!active || active.deploymentId !== deploymentId) {
        throw Object.assign(new Error("deployment_not_active"), {code: "deployment_not_active"});
      }
      const health = bridge.health();
      if (!health.ok || health.modules !== 16 || health.autoPublish || health.autoSpend || health.storefrontMutation) {
        throw Object.assign(new Error("marketing runtime verification failed"), {
          code: "marketing_runtime_verification_failed",
        });
      }
      return {
        verified: true,
        modules: health.modules,
        releaseId: request.releaseId,
        sourceCommit: request.sourceCommit,
        artifactFingerprint: request.artifactFingerprint,
        publicOrigin: request.publicOrigin,
      };
    },

    async rollback({deploymentId, request}) {
      const matched = active?.deploymentId === deploymentId;
      if (matched) active = null;
      return {rolledBack: matched, releaseId: request.releaseId};
    },
  });
}

export function createHerculesDeployAdaptersFromEnv(
  env = process.env,
  {fetchImpl = globalThis.fetch} = {},
) {
  const adapters = new Map([
    ["hercules_marketing_16", createMarketing16TargetAdapter()],
  ]);
  const supabase = createSupabaseEdgeFunctionAdapterFromEnv(env, {fetchImpl});
  if (supabase) adapters.set("supabase_edge_function", supabase);
  return adapters;
}

export async function startHerculesDeployService({
  env = process.env,
  adapters,
  fetchImpl = globalThis.fetch,
} = {}) {
  const config = readHerculesDeployConfig(env);
  const resolvedAdapters = adapters ?? createHerculesDeployAdaptersFromEnv(env, {fetchImpl});
  const service = listenHerculesDeployService({
    root: config.root,
    recoveryRoot: config.recoveryRoot,
    token: config.token,
    adapters: resolvedAdapters,
    pollIntervalMs: config.pollIntervalMs,
    host: config.host,
    port: config.port,
  });

  await new Promise((resolve, reject) => {
    if (service.server.listening) return resolve();
    const onError = (error) => {
      service.server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      service.server.off("error", onError);
      resolve();
    };
    service.server.once("error", onError);
    service.server.once("listening", onListening);
  });

  return {
    ...service,
    config: safeHerculesDeployConfig(config),
    shutdown: () => new Promise((resolve, reject) => {
      service.server.close((error) => error ? reject(error) : resolve());
    }),
  };
}
