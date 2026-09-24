import {startForgeProductionService} from "./production.mjs";

const service = await startForgeProductionService();

console.log(JSON.stringify({
  ok: true,
  service: "hercules-forge-control-api",
  mode: "production",
  ...service.config,
}, null, 2));

let stopping = false;
async function stop(signal) {
  if (stopping) return;
  stopping = true;
  try {
    await service.shutdown();
    console.log(JSON.stringify({ok: true, stopped: true, signal}));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      stopped: false,
      signal,
      error: error?.message ?? "shutdown failed",
    }));
    process.exitCode = 1;
  }
}

process.once("SIGTERM", () => void stop("SIGTERM"));
process.once("SIGINT", () => void stop("SIGINT"));
