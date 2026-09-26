import {isAbsolute, relative, resolve} from "node:path";
import {listenHerculesDeployService} from "./control-api.mjs";

function required(env, name) {
  const value = env[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(name + " is required");
  }
  return value.trim();
}

function nestedOrSame(parent, child) {\n  const path = relative(parent, child);\n  return path === "" || (!path.startsWith("..") && !isAbsolute(path));\n}\n\nfunction integer(name, value, min, max) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(name + " must be an integer between " + min + " and " + max);
  }
  return parsed;
}

export function readHerculesDeployConfig(env = process.env) {
  const root = resolve(required(env, "HERCULES_DEPLOY_ROOT"));
  const token = required(env, "HERCULES_DEPLOY_CONTROL_TOKEN");
  if (token.length < 32) {
    throw new Error("HERCULES_DEPLOY_CONTROL_TOKEN must be at least 32 characters");
  }
  return {
    root,
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
    host: config.host,
    port: config.port,
    pollIntervalMs: config.pollIntervalMs,
  };
}

export async function startHerculesDeployService({
  env = process.env,
  adapters = new Map(),
} = {}) {
  const config = readHerculesDeployConfig(env);
  const service = listenHerculesDeployService({
    root: config.root,
    token: config.token,
    adapters,
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
