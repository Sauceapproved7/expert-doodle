import {randomBytes} from "node:crypto";
import {HERCULES_MODEL_SLOTS} from "./catalog.mjs";
import {HERCULES_MODEL_CANDIDATES} from "./candidates.mjs";
import {HerculesEmbeddedAgentRouter} from "./embedded-agent-router.mjs";
import {HerculesEmbeddedRetrieval} from "./embedded-retrieval.mjs";
import {HerculesEmbeddedGuard} from "./embedded-guard.mjs";
import {HerculesEmbeddedFamilyClassifier} from "./embedded-family-classifier.mjs";
import {HerculesEmbeddedCoreNeuralV03} from "./embedded-core-neural-v0.3.mjs";
import {HerculesEmbeddedCoderNeuralV02} from "./embedded-coder-neural-v0.2.mjs";
import {listenModelPlaneService} from "./service.mjs";

const configuredToken = process.env.HERCULES_MODEL_TOKEN;
const token = configuredToken ?? randomBytes(24).toString("hex");
const host = process.env.HERCULES_MODEL_HOST ?? "127.0.0.1";
const port = Number(process.env.HERCULES_MODEL_PORT ?? 38900);
const nativeOnly = process.env.HERCULES_MODEL_NATIVE_ONLY !== "false";
const candidateEvaluationEnabled =
  process.env.HERCULES_MODEL_ENABLE_CANDIDATES === "true";

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

const candidateRuntimes = {};
if (candidateEvaluationEnabled) {
  const [coreNeural, coderNeural] = await Promise.all([
    HerculesEmbeddedCoreNeuralV03.load(),
    HerculesEmbeddedCoderNeuralV02.load(),
  ]);
  candidateRuntimes["hercules-core-neural-v03"] = coreNeural;
  candidateRuntimes["hercules-coder-neural-v02"] = coderNeural;
}

listenModelPlaneService({
  models: HERCULES_MODEL_SLOTS,
  token,
  nativeOnly,
  candidates: HERCULES_MODEL_CANDIDATES,
  candidateRuntimes,
  candidateEvaluationEnabled,
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
  candidateEvaluationEnabled,
  candidateRuntimes: Object.keys(candidateRuntimes).length,
  tokenSource: configuredToken ? "environment" : "generated-session",
}, null, 2));
