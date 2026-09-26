import {startHerculesDeployService} from "./service.mjs";

const service = await startHerculesDeployService();
console.log(JSON.stringify({
  ok: true,
  service: "hercules-deploy-plane",
  version: "0.1",
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
      error: error?.message ?? "shutdown_failed",
    }));
    process.exitCode = 1;
  }
}

process.once("SIGTERM", () => void stop("SIGTERM"));
process.once("SIGINT", () => void stop("SIGINT"));
