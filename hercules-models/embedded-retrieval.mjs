import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {
  embedText,
  rerankDocuments,
  trainNativeRetriever,
} from "../hercules-training/native-retrieval.mjs";
import {stableStringify} from "../hercules-training/hash.mjs";

export const HERCULES_RETRIEVAL_CHECKPOINT_SHA256 =
  "6904b2617443a36377cfe20eb1010579d50df479041bece6bc7d8ce032543fa4";

function parseJsonl(text) {
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function checkpointSha256(model) {
  return createHash("sha256")
    .update(Buffer.from(stableStringify(model) + "\n", "utf8"))
    .digest("hex");
}

export class HerculesEmbeddedRetrieval {
  constructor(model) {
    this.model = structuredClone(model);
    const actual = checkpointSha256(this.model);
    if (actual !== HERCULES_RETRIEVAL_CHECKPOINT_SHA256) {
      throw new Error("embedded Hercules retrieval checkpoint hash mismatch");
    }
  }

  static async load({
    datasetUrl = new URL(
      "../hercules-training/bootstrap/retrieval-documents.jsonl",
      import.meta.url,
    ),
  } = {}) {
    const documentsText = await readFile(fileURLToPath(datasetUrl), "utf8");
    const model = trainNativeRetriever(parseJsonl(documentsText));
    return new HerculesEmbeddedRetrieval(model);
  }

  infer(input, {task = null} = {}) {
    if (task === "embedding") {
      const text = typeof input === "string" ? input : String(input?.text ?? "");
      if (!text.trim()) throw new TypeError("embedding input text is required");
      return {
        modelId: "hercules-retrieval",
        checkpoint: "sha256:" + HERCULES_RETRIEVAL_CHECKPOINT_SHA256,
        task: "embedding",
        vector: embedText(this.model, text),
      };
    }

    if (task === "rerank") {
      const query = String(input?.query ?? "");
      const documents = Array.isArray(input?.documents) ? input.documents : [];
      if (!query.trim()) throw new TypeError("rerank query is required");
      if (documents.length === 0) throw new TypeError("rerank documents are required");
      if (documents.length > 100) throw new TypeError("rerank supports at most 100 documents");

      const normalized = documents.map((document) => ({
        id: String(document?.id ?? ""),
        text: String(document?.text ?? ""),
      }));
      if (normalized.some((document) => !document.id || !document.text)) {
        throw new TypeError("each rerank document requires id and text");
      }

      return {
        modelId: "hercules-retrieval",
        checkpoint: "sha256:" + HERCULES_RETRIEVAL_CHECKPOINT_SHA256,
        task: "rerank",
        ranking: rerankDocuments(this.model, query, normalized),
      };
    }

    throw new TypeError("retrieval runtime requires embedding or rerank task");
  }
}
