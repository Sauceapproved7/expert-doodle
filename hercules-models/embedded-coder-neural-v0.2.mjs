import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {stableStringify} from "../hercules-training/hash.mjs";
import {trainTokenizer} from "../hercules-training/native-tokenizer.mjs";
import {
  generateNeuralText,
  trainNeuralNextTokenModel,
} from "../hercules-training/native-neural-language-model.mjs";

export const HERCULES_CODER_NEURAL_V02_CHECKPOINT_SHA256 =
  "7ffb1ec7f2fa70349db6711f101d45fedd5b6440fb9d9e0d72a559fe7ebf2bae";

function parseJsonl(text) {
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function checkpointSha256(payload) {
  return createHash("sha256")
    .update(Buffer.from(stableStringify(payload) + "\n", "utf8"))
    .digest("hex");
}

export class HerculesEmbeddedCoderNeuralV02 {
  constructor({tokenizer, neuralModel}) {
    this.tokenizer = structuredClone(tokenizer);
    this.neuralModel = structuredClone(neuralModel);

    const actual = checkpointSha256({
      tokenizer: this.tokenizer,
      neuralModel: this.neuralModel,
    });
    if (actual !== HERCULES_CODER_NEURAL_V02_CHECKPOINT_SHA256) {
      throw new Error("embedded Hercules Coder neural v0.2 checkpoint hash mismatch");
    }
  }

  static async load({
    datasetUrl = new URL(
      "../hercules-training/bootstrap/coder-neural-v0.2-train.jsonl",
      import.meta.url,
    ),
  } = {}) {
    const text = await readFile(fileURLToPath(datasetUrl), "utf8");
    const rows = parseJsonl(text);
    const trainingTexts = rows.map((row) => String(row.text ?? ""));
    if (trainingTexts.some((value) => !value)) {
      throw new Error("Coder neural candidate training corpus contains empty text");
    }

    const tokenizer = trainTokenizer(trainingTexts, {
      maxVocabulary: 2048,
      minFrequency: 1,
    });
    const neuralModel = trainNeuralNextTokenModel(tokenizer, trainingTexts, {
      contextLength: 3,
      embeddingDim: 10,
      epochs: 28,
      learningRate: 0.06,
      seed: 41,
      initScale: 0.04,
    });

    return new HerculesEmbeddedCoderNeuralV02({
      tokenizer,
      neuralModel,
    });
  }

  infer(input, {task = null} = {}) {
    if (task !== "code") {
      throw new TypeError("Coder neural v0.2 candidate requires code task");
    }

    const prompt =
      typeof input === "string" ? input : String(input?.prompt ?? input?.text ?? "");
    if (!prompt.trim()) throw new TypeError("Coder neural v0.2 prompt is required");

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
      candidateId: "hercules-coder-neural-v02",
      family: "hercules-coder",
      checkpoint: "sha256:" + HERCULES_CODER_NEURAL_V02_CHECKPOINT_SHA256,
      version: "0.2-candidate",
      task: "code",
      ...generation,
    };
  }
}
