import {resolve} from "node:path";
import {listenForgeControlService} from "./control-api.mjs";
import {HttpForgeInterpreter} from "./interpreter.mjs";
import {HttpForgeNotificationAdapter} from "./notifications.mjs";
import {ForgeLoginRateLimiter} from "./rate-limit.mjs";
import {DEFAULT_RUNTIME_DATA_MAX_BYTES} from "./runtime-data.mjs";

function requireString(env, name) {
  const value = env[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(name + " is required in production");
  }
  return value.trim();
}

function parseInteger(name, value, {min, max}) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(name + " must be an integer between " + min + " and " + max);
  }
  return parsed;
}

function validatePublicOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("FORGE_PUBLIC_ORIGIN must be a valid URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("FORGE_PUBLIC_ORIGIN must use https");
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("FORGE_PUBLIC_ORIGIN must be an HTTPS origin without credentials, path, query, or fragment");
  }
  return url.origin;
}

function validateInterpreterUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("FORGE_INTERPRETER_URL must be a valid URL");
  }
  const loopback = ["127.0.0.1", "::1", "localhost"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("FORGE_INTERPRETER_URL must use https unless it is loopback");
  }
  return url.toString();
}

function validateNotificationUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("FORGE_NOTIFICATION_URL must be a valid URL");
  }
  const loopback = ["127.0.0.1", "::1", "localhost"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("FORGE_NOTIFICATION_URL must use https unless it is loopback");
  }
  if (url.username || url.password) {
    throw new Error("FORGE_NOTIFICATION_URL must not embed credentials");
  }
  return url.toString();
}

export function readForgeProductionConfig(env = process.env) {
  const root = resolve(requireString(env, "FORGE_ROOT"));
  const token = requireString(env, "FORGE_CONTROL_TOKEN");
  if (token.length < 32) {
    throw new Error("FORGE_CONTROL_TOKEN must be at least 32 characters in production");
  }

  const publicOrigin = validatePublicOrigin(requireString(env, "FORGE_PUBLIC_ORIGIN"));
  const host = String(env.FORGE_HOST ?? "0.0.0.0").trim();
  if (!host) throw new Error("FORGE_HOST must not be empty");

  const port = parseInteger(
    "FORGE_PORT",
    env.FORGE_PORT ?? env.PORT ?? 38700,
    {min: 1, max: 65535},
  );
  const runtimeDataMaxBytes = parseInteger(
    "FORGE_DATA_MAX_BYTES",
    env.FORGE_DATA_MAX_BYTES ?? DEFAULT_RUNTIME_DATA_MAX_BYTES,
    {min: 1024, max: Number.MAX_SAFE_INTEGER},
  );
  const loginMaxFailures = parseInteger(
    "FORGE_LOGIN_MAX_FAILURES",
    env.FORGE_LOGIN_MAX_FAILURES ?? 8,
    {min: 1, max: 1000},
  );
  const loginWindowMs = parseInteger(
    "FORGE_LOGIN_WINDOW_MS",
    env.FORGE_LOGIN_WINDOW_MS ?? 5 * 60 * 1000,
    {min: 1000, max: 24 * 60 * 60 * 1000},
  );
  const recoveryMaxRequests = parseInteger(
    "FORGE_RECOVERY_MAX_REQUESTS",
    env.FORGE_RECOVERY_MAX_REQUESTS ?? 3,
    {min: 1, max: 1000},
  );
  const recoveryWindowMs = parseInteger(
    "FORGE_RECOVERY_WINDOW_MS",
    env.FORGE_RECOVERY_WINDOW_MS ?? 60 * 60 * 1000,
    {min: 1000, max: 7 * 24 * 60 * 60 * 1000},
  );

  const interpreterUrl = env.FORGE_INTERPRETER_URL
    ? validateInterpreterUrl(env.FORGE_INTERPRETER_URL)
    : null;
  const notificationUrl = env.FORGE_NOTIFICATION_URL
    ? validateNotificationUrl(env.FORGE_NOTIFICATION_URL)
    : null;

  return {
    root,
    token,
    publicOrigin,
    host,
    port,
    runtimeDataMaxBytes,
    loginMaxFailures,
    loginWindowMs,
    recoveryMaxRequests,
    recoveryWindowMs,
    interpreterUrl,
    interpreterToken: interpreterUrl ? (env.FORGE_INTERPRETER_TOKEN ?? null) : null,
    notificationUrl,
    notificationToken: notificationUrl ? (env.FORGE_NOTIFICATION_TOKEN ?? null) : null,
  };
}

export function safeForgeProductionSummary(config) {
  return {
    root: config.root,
    publicOrigin: config.publicOrigin,
    host: config.host,
    port: config.port,
    runtimeDataMaxBytes: config.runtimeDataMaxBytes,
    loginMaxFailures: config.loginMaxFailures,
    loginWindowMs: config.loginWindowMs,
    recoveryMaxRequests: config.recoveryMaxRequests,
    recoveryWindowMs: config.recoveryWindowMs,
    promptIngress: Boolean(config.interpreterUrl),
    identityLifecycle: Boolean(config.notificationUrl),
    secureSessionCookies: true,
  };
}

export async function startForgeProductionService({env = process.env} = {}) {
  const config = readForgeProductionConfig(env);
  const interpreter = config.interpreterUrl
    ? new HttpForgeInterpreter({
        endpoint: config.interpreterUrl,
        token: config.interpreterToken,
      })
    : null;
  const loginRateLimiter = new ForgeLoginRateLimiter({
    maxFailures: config.loginMaxFailures,
    windowMs: config.loginWindowMs,
  });
  const recoveryRateLimiter = new ForgeLoginRateLimiter({
    maxFailures: config.recoveryMaxRequests,
    windowMs: config.recoveryWindowMs,
  });
  const notificationAdapter = config.notificationUrl
    ? new HttpForgeNotificationAdapter({
        endpoint: config.notificationUrl,
        token: config.notificationToken,
      })
    : null;

  const server = listenForgeControlService({
    root: config.root,
    token: config.token,
    interpreter,
    secureSessionCookies: true,
    runtimeDataMaxBytes: config.runtimeDataMaxBytes,
    loginRateLimiter,
    recoveryRateLimiter,
    notificationAdapter,
    serviceMode: "production",
    publicOrigin: config.publicOrigin,
    host: config.host,
    port: config.port,
  });

  await new Promise((resolveListening, reject) => {
    if (server.listening) return resolveListening();
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolveListening();
    };
    server.once("error", onError);
    server.once("listening", onListening);
  });

  let stopping = null;
  const shutdown = () => {
    if (stopping) return stopping;
    stopping = new Promise((resolveShutdown, reject) => {
      server.close((error) => error ? reject(error) : resolveShutdown());
    });
    return stopping;
  };

  return {
    server,
    config: safeForgeProductionSummary(config),
    shutdown,
  };
}
