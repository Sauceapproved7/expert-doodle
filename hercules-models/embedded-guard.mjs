import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {
  classifyGuardAction,
  trainGuardClassifier,
} from "../hercules-training/native-guard.mjs";
import {stableStringify} from "../hercules-training/hash.mjs";

export const HERCULES_GUARD_CHECKPOINT_SHA256 =
  "f6e6a598aa1183234ab7e9d06ace6e79bf25f87d3f53746767f162d9115425d4";

function parseJsonl(text) {
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function checkpointSha256(model) {
  return createHash("sha256")
    .update(Buffer.from(stableStringify(model) + "\n", "utf8"))
    .digest("hex");
}

export class HerculesEmbeddedGuard {
  constructor(model) {
    this.model = structuredClone(model);
    const actual = checkpointSha256(this.model);
    if (actual !== HERCULES_GUARD_CHECKPOINT_SHA256) {
      throw new Error("embedded Hercules Guard checkpoint hash mismatch");
    }
  }

  static async load({
    datasetUrl = new URL(
      "../hercules-training/bootstrap/guard-actions-train.jsonl",
      import.meta.url,
    ),
  } = {}) {
    const text = await readFile(fileURLToPath(datasetUrl), "utf8");
    const model = trainGuardClassifier(parseJsonl(text), {alpha: 1});
    return new HerculesEmbeddedGuard(model);
  }

  infer(input, {task = null} = {}) {
    if (task !== "safety") {
      throw new TypeError("Guard runtime requires safety task");
    }

    const text = typeof input === "string" ? input : String(input?.text ?? "");
    if (!text.trim()) throw new TypeError("Guard input text is required");

    const result = classifyGuardAction(this.model, text);
    return {
      modelId: "hercules-guard",
      checkpoint: "sha256:" + HERCULES_GUARD_CHECKPOINT_SHA256,
      task: "safety",
      decision: result.decision,
      scores: result.scores,
    };
  }
}
