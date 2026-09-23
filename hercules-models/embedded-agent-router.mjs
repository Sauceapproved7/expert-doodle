import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {
  predictAgentRouter,
  scoreAgentRouter,
  trainAgentRouter,
} from "../hercules-training/native-agent-router.mjs";
import {stableStringify} from "../hercules-training/hash.mjs";

export const HERCULES_AGENT_ROUTER_CHECKPOINT_SHA256 =
  "ae3475d53cc75959bc52ca7e6bd39b6c84b693c71a2dbcac28977a65a220f618";

function parseJsonl(text) {
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function checkpointSha256(model) {
  return createHash("sha256")
    .update(Buffer.from(stableStringify(model) + "\n", "utf8"))
    .digest("hex");
}

export class HerculesEmbeddedAgentRouter {
  constructor(model) {
    this.model = structuredClone(model);
    const actual = checkpointSha256(this.model);
    if (actual !== HERCULES_AGENT_ROUTER_CHECKPOINT_SHA256) {
      throw new Error("embedded Hercules agent checkpoint hash mismatch");
    }
  }

  static async load({
    datasetUrl = new URL(
      "../hercules-training/bootstrap/agent-routing-train.jsonl",
      import.meta.url,
    ),
  } = {}) {
    const trainText = await readFile(fileURLToPath(datasetUrl), "utf8");
    const model = trainAgentRouter(parseJsonl(trainText), {alpha: 1});
    return new HerculesEmbeddedAgentRouter(model);
  }

  infer(input) {
    const text = typeof input === "string" ? input : String(input?.text ?? "");
    if (!text.trim()) throw new TypeError("agent router input text is required");

    return {
      modelId: "hercules-agent",
      checkpoint: "sha256:" + HERCULES_AGENT_ROUTER_CHECKPOINT_SHA256,
      route: predictAgentRouter(this.model, text),
      scores: scoreAgentRouter(this.model, text),
    };
  }
}
