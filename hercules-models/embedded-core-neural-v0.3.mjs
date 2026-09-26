import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {stableStringify} from "../hercules-training/hash.mjs";
import {trainTokenizer} from "../hercules-training/native-tokenizer.mjs";
import {
  generateNeuralText,
  trainNeuralNextTokenModel,
} from "../hercules-training/native-neural-language-model.mjs";

export const HERCULES_CORE_NEURAL_V03_CHECKPOINT_SHA256 =
  "223aebb35f003ff5e144e29bfd8a613206802b7cdc70da35be31f067c0b08b9f";

function parseJsonl(text) {
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function checkpointSha256(payload) {
  return createHash("sha256")
    .update(Buffer.from(stableStringify(payload) + "\n", "utf8"))
    .digest("hex");
}

export class HerculesEmbeddedCoreNeuralV03 {
  constructor({tokenizer, neuralModel}) {
    this.tokenizer = structuredClone(tokenizer);
    this.neuralModel = structuredClone(neuralModel);

    const actual = checkpointSha256({
      tokenizer: this.tokenizer,
      neuralModel: this.neuralModel,
    });
    if (actual !== HERCULES_CORE_NEURAL_V03_CHECKPOINT_SHA256) {
      throw new Error("embedded Hercules Core neural v0.3 checkpoint hash mismatch");
    }
  }

  static async load({
    datasetUrl = new URL(
      "../hercules-training/bootstrap/language-foundation-train.jsonl",
      import.meta.url,
    ),
  } = {}) {
    const text = await readFile(fileURLToPath(datasetUrl), "utf8");
    const rows = parseJsonl(text);
    const trainingTexts = rows.map((row) => String(row.text ?? ""));
    if (trainingTexts.some((value) => !value)) {
      throw new Error("Core neural candidate training corpus contains empty text");
    }

    const tokenizer = trainTokenizer(trainingTexts, {
      maxVocabulary: 2048,
      minFrequency: 1,
    });
    const neuralModel = trainNeuralNextTokenModel(tokenizer, trainingTexts, {
      contextLength: 2,
      embeddingDim: 12,
      epochs: 36,
      learningRate: 0.08,
      seed: 37,
      initScale: 0.04,
    });

    return new HerculesEmbeddedCoreNeuralV03({
      tokenizer,
      neuralModel,
    });
  }

  infer(input, {task = null} = {}) {
    if (task !== "general") {
      throw new TypeError("Core neural v0.3 candidate requires general task");
    }

    const prompt =
      typeof input === "string" ? input : String(input?.prompt ?? input?.text ?? "");
    if (!prompt.trim()) throw new TypeError("Core neural v0.3 prompt is required");

    const maxTokens = input && typeof input === "object" && input.maxTokens != null
      ? Number(input.maxTokens)
      : 48;

    const generation = generateNeuralText(
      this.tokenizer,
      this.neuralModel,
      prompt,
      {maxTokens},
    );

    return {
      candidateId: "hercules-core-neural-v03",
      family: "hercules-core",
      checkpoint: "sha256:" + HERCULES_CORE_NEURAL_V03_CHECKPOINT_SHA256,
      version: "0.3-candidate",
      task: "general",
      ...generation,
    };
  }
}
