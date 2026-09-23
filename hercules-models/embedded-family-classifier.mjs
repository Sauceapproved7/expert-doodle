import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {
  predictFamilyClassifier,
  scoreFamilyClassifier,
  trainFamilyClassifier,
} from "../hercules-training/native-family-classifier.mjs";
import {stableStringify} from "../hercules-training/hash.mjs";

export const HERCULES_FAMILY_CLASSIFIER_CHECKPOINTS = Object.freeze({
  "hercules-core": "095cfc427f2e0de60df0ffc6d7865d3b861ceff65fb68dc4ba39f243d857c83b",
  "hercules-coder": "59fdb5feb39bdcaecd876fa078d6a06f3fa086e70ca19bef11522f12a784f053",
  "hercules-vision": "fb9d35b882329104ff142ee2dbd3131a74891db9deae2269183d4973ff9ecd6c",
  "hercules-voice": "46f91666a83ed86981b3605e2e1e53ccf2ea70ad2d20abf465684d34115a7004",
  "hercules-research": "7bfc399aa0118873b5cba1923a1c0f36f79ecb06534cd2df683e84808fe953d9",
});

const ALLOWED_TASKS = Object.freeze({
  "hercules-core": new Set(["general"]),
  "hercules-coder": new Set(["code"]),
  "hercules-vision": new Set(["vision"]),
  "hercules-voice": new Set(["speech-to-text", "text-to-speech"]),
  "hercules-research": new Set(["research"]),
});

function checkpointSha256(model) {
  return createHash("sha256")
    .update(Buffer.from(stableStringify(model) + "\n", "utf8"))
    .digest("hex");
}

export class HerculesEmbeddedFamilyClassifier {
  constructor({modelId, capability, model}) {
    this.modelId = modelId;
    this.capability = capability;
    this.model = structuredClone(model);

    const expected = HERCULES_FAMILY_CLASSIFIER_CHECKPOINTS[modelId];
    if (!expected) throw new Error("unknown Hercules family classifier: " + modelId);
    const actual = checkpointSha256(this.model);
    if (actual !== expected) {
      throw new Error("embedded Hercules family checkpoint hash mismatch: " + modelId);
    }
  }

  static async load(modelId, {
    datasetUrl = new URL(
      "../hercules-training/bootstrap/five-family-classifiers.json",
      import.meta.url,
    ),
  } = {}) {
    const config = JSON.parse(await readFile(fileURLToPath(datasetUrl), "utf8"));
    const family = config.families?.[modelId];
    if (!family) throw new Error("missing Hercules family training data: " + modelId);

    const short = modelId.replace(/^hercules-/, "");
    const model = trainFamilyClassifier(family.train, {
      alpha: 1,
      format: "hercules-" + short + "-classifier/0.1",
    });

    return new HerculesEmbeddedFamilyClassifier({
      modelId,
      capability: family.capability,
      model,
    });
  }

  infer(input, {task = null} = {}) {
    if (!ALLOWED_TASKS[this.modelId]?.has(task)) {
      throw new TypeError(this.modelId + " runtime does not support task: " + task);
    }

    const text = typeof input === "string" ? input : String(input?.text ?? "");
    if (!text.trim()) throw new TypeError(this.modelId + " input text is required");

    return {
      modelId: this.modelId,
      checkpoint: "sha256:" + HERCULES_FAMILY_CLASSIFIER_CHECKPOINTS[this.modelId],
      capability: this.capability,
      task,
      route: predictFamilyClassifier(this.model, text),
      scores: scoreFamilyClassifier(this.model, text),
    };
  }
}
