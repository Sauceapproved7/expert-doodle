import {fileURLToPath} from "node:url";

import {createHerculesBankApi} from "./api.mjs";
import {HerculesBankRuntime} from "./runtime.mjs";

function required(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(label + " is required");
  }
  return value.trim();
}

function endpointFor(address) {
  if (!address || typeof address === "string") throw new Error("bank service address unavailable");
  const host = address.address.includes(":") ? "[" + address.address + "]" : address.address;
  return "http://" + host + ":" + address.port;
}

export async function startHerculesBankService({
  statePath,
  jwtSecret,
  currency = "USD",
  issuer = "hercules-base",
  audience = "hercules-base-api",
  host = "127.0.0.1",
  port = 38920,
  nowSeconds = () => Math.floor(Date.now() / 1000),
} = {}) {
  required(statePath, "statePath");
  if (typeof jwtSecret !== "string" || Buffer.byteLength(jwtSecret) < 32) {
    throw new TypeError("JWT secret must be at least 32 bytes");
  }
  required(host, "host");
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new TypeError("port is invalid");
  }

  const runtime = await HerculesBankRuntime.open({statePath, currency});
  const server = createHerculesBankApi({
    runtime,
    jwtSecret,
    issuer,
    audience,
    nowSeconds,
  });

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });

  return Object.freeze({
    server,
    runtime,
    endpoint:endpointFor(server.address()),
  });
}

async function main() {
  const statePath = required(process.env.HERCULES_BANK_STATE_PATH, "HERCULES_BANK_STATE_PATH");
  const jwtSecret = required(process.env.HERCULES_BASE_JWT_SECRET, "HERCULES_BASE_JWT_SECRET");
  const host = process.env.HERCULES_BANK_HOST?.trim() || "127.0.0.1";
  const currency = process.env.HERCULES_BANK_CURRENCY?.trim() || "USD";
  const portValue = process.env.HERCULES_BANK_PORT?.trim() || "38920";
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TypeError("HERCULES_BANK_PORT is invalid");
  }

  const service = await startHerculesBankService({
    statePath,
    jwtSecret,
    host,
    port,
    currency,
  });

  console.log(JSON.stringify({
    ok:true,
    service:"hercules-bank",
    mode:service.runtime.mode,
    currency:service.runtime.currency,
    endpoint:service.endpoint,
    externalRails:false,
  }));

  const shutdown = () => {
    service.server.close(() => process.exit(0));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

const invoked = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invoked) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
