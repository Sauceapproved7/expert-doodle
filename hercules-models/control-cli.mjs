import {randomBytes} from "node:crypto";
import {HERCULES_MODEL_SLOTS} from "./catalog.mjs";
import {HerculesEmbeddedAgentRouter} from "./embedded-agent-router.mjs";
import {HerculesEmbeddedRetrieval} from "./embedded-retrieval.mjs";
import {HerculesEmbeddedGuard} from "./embedded-guard.mjs";
import {listenModelPlaneService} from "./service.mjs";

const token = process.env.HERCULES_MODEL_TOKEN ?? randomBytes(24).toString("hex");
const host = process.env.HERCULES_MODEL_HOST ?? "127.0.0.1";
const port = Number(process.env.HERCULES_MODEL_PORT ?? 38900);
const nativeOnly = process.env.HERCULES_MODEL_NATIVE_ONLY !== "false";

const [agentRouter, retrieval, guard] = await Promise.all([
  HerculesEmbeddedAgentRouter.load(),
  HerculesEmbeddedRetrieval.load(),
  HerculesEmbeddedGuard.load(),
]);

listenModelPlaneService({
  models: HERCULES_MODEL_SLOTS,
  token,
  nativeOnly,
  embeddedRuntimes: {
    "hercules-agent": agentRouter,
    "hercules-retrieval": retrieval,
    "hercules-guard": guard,
  },
  host,
  port,
});

console.log(JSON.stringify({
  ok: true,
  service: "hercules-model-plane",
  version: "0.1",
  host,
  port,
  nativeOnly,
  modelSlots: HERCULES_MODEL_SLOTS.length,
  activeModels: HERCULES_MODEL_SLOTS.filter((model) => model.state === "active").length,
  embeddedRuntimes: 3,
  tokenGenerated: !process.env.HERCULES_MODEL_TOKEN,
  controlToken: !process.env.HERCULES_MODEL_TOKEN ? token : undefined,
}, null, 2));
