import {randomBytes} from "node:crypto";
import {HERCULES_MODEL_SLOTS} from "./catalog.mjs";
import {HERCULES_MODEL_CANDIDATES} from "./candidates.mjs";
import {HerculesEmbeddedAgentRouter} from "./embedded-agent-router.mjs";
import {HerculesEmbeddedRetrieval} from "./embedded-retrieval.mjs";
import {HerculesEmbeddedGuard} from "./embedded-guard.mjs";
import {HerculesEmbeddedFamilyClassifier} from "./embedded-family-classifier.mjs";
import {listenModelPlaneService} from "./service.mjs";

const token = process.env.HERCULES_MODEL_TOKEN ?? randomBytes(24).toString("hex");
const host = process.env.HERCULES_MODEL_HOST ?? "127.0.0.1";
const port = Number(process.env.HERCULES_MODEL_PORT ?? 38900);
const nativeOnly = process.env.HERCULES_MODEL_NATIVE_ONLY !== "false";

const [
  agentRouter,
  retrieval,
  guard,
  core,
  coder,
  vision,
  voice,
  research,
] = await Promise.all([
  HerculesEmbeddedAgentRouter.load(),
  HerculesEmbeddedRetrieval.load(),
  HerculesEmbeddedGuard.load(),
  HerculesEmbeddedFamilyClassifier.load("hercules-core"),
  HerculesEmbeddedFamilyClassifier.load("hercules-coder"),
  HerculesEmbeddedFamilyClassifier.load("hercules-vision"),
  HerculesEmbeddedFamilyClassifier.load("hercules-voice"),
  HerculesEmbeddedFamilyClassifier.load("hercules-research"),
]);

listenModelPlaneService({
  models: HERCULES_MODEL_SLOTS,
  token,
  nativeOnly,
  candidates: HERCULES_MODEL_CANDIDATES,
  embeddedRuntimes: {
    "hercules-agent": agentRouter,
    "hercules-retrieval": retrieval,
    "hercules-guard": guard,
    "hercules-core": core,
    "hercules-coder": coder,
    "hercules-vision": vision,
    "hercules-voice": voice,
    "hercules-research": research,
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
  embeddedRuntimes: 8,
  candidateModels: HERCULES_MODEL_CANDIDATES.length,
  tokenGenerated: !process.env.HERCULES_MODEL_TOKEN,
  controlToken: !process.env.HERCULES_MODEL_TOKEN ? token : undefined,
}, null, 2));
