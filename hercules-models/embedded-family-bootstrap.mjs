import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {HERCULES_BOOTSTRAP_CANDIDATES} from "./bootstrap-catalog.mjs";
import {stableStringify} from "../hercules-training/hash.mjs";
import {
  predictBootstrapClassifier,
  rankBootstrapRetriever,
  scoreBootstrapClassifier,
  trainBootstrapClassifier,
  trainBootstrapRetriever,
} from "../hercules-training/native-bootstrap-models.mjs";

function checkpointSha256(model) {
  return createHash("sha256")
    .update(Buffer.from(stableStringify(model) + "\n", "utf8"))
    .digest("hex");
}

function requiredText(input, field = "text") {
  const value = typeof input === "string"
    ? input
    : String(input?.[field] ?? input?.text ?? "");
  if (!value.trim()) throw new TypeError(field + " is required");
  return value;
}

export class HerculesEmbeddedFamilyBootstrap {
  constructor({manifest, capability, kind, model}) {
    this.manifest = structuredClone(manifest);
    this.capability = capability;
    this.kind = kind;
    this.model = structuredClone(model);

    const expected = this.manifest.checkpoint.replace(/^sha256:/, "");
    const actual = checkpointSha256(this.model);
    if (actual !== expected) {
      throw new Error("embedded Hercules bootstrap checkpoint hash mismatch: " + this.manifest.id);
    }
  }

  static async load(modelId, {
    datasetUrl = new URL(
      "../hercules-training/bootstrap/family-bootstrap.json",
      import.meta.url,
    ),
  } = {}) {
    const manifest = HERCULES_BOOTSTRAP_CANDIDATES.find((item) => item.id === modelId);
    if (!manifest) throw new Error("unknown Hercules bootstrap model: " + modelId);

    const parsed = JSON.parse(await readFile(fileURLToPath(datasetUrl), "utf8"));
    const config = parsed.families?.[manifest.family];
    if (!config) throw new Error("missing bootstrap family data: " + manifest.family);

    const model = config.kind === "retrieval"
      ? trainBootstrapRetriever(config.documents)
      : trainBootstrapClassifier(config.train, {
          alpha: 1,
          format: "hercules-" + config.capability + "/0.1",
        });

    return new HerculesEmbeddedFamilyBootstrap({
      manifest,
      capability: config.capability,
      kind: config.kind,
      model,
    });
  }

  infer(input) {
    if (this.kind === "retrieval") {
      const query = requiredText(input, "query");
      const limit = Number.isInteger(input?.limit) ? input.limit : 5;
      return {
        modelId: this.manifest.id,
        family: this.manifest.family,
        capability: this.capability,
        checkpoint: this.manifest.checkpoint,
        results: rankBootstrapRetriever(this.model, query, {limit}),
      };
    }

    const text = requiredText(input);
    return {
      modelId: this.manifest.id,
      family: this.manifest.family,
      capability: this.capability,
      checkpoint: this.manifest.checkpoint,
      label: predictBootstrapClassifier(this.model, text),
      scores: scoreBootstrapClassifier(this.model, text),
    };
  }
}
