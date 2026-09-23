import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {buildNativeRetriever} from "../hercules-training/bootstrap-retrieval.mjs";
import {
  embedText,
  rerankDocuments,
  trainNativeRetriever,
} from "../hercules-training/native-retrieval.mjs";

const sourceCommit = "a".repeat(40);

test("native retriever trains deterministically and passes held-out ranking gate", async () => {
  const [documentsText, evaluationText] = await Promise.all([
    readFile("hercules-training/bootstrap/retrieval-documents.jsonl", "utf8"),
    readFile("hercules-training/bootstrap/retrieval-eval.jsonl", "utf8"),
  ]);

  const first = buildNativeRetriever({
    documentsText,
    evaluationText,
    sourceCommit,
    createdAt: "2026-09-23T21:15:00Z",
  });
  const second = buildNativeRetriever({
    documentsText,
    evaluationText,
    sourceCommit,
    createdAt: "2026-09-23T21:15:00Z",
  });

  assert.equal(first.ok, true);
  assert.equal(
    first.checkpoint.checkpoint.artifactSha256,
    second.checkpoint.checkpoint.artifactSha256,
  );
  assert.ok(first.evaluation.result.metrics.top1 >= 0.8);
  assert.ok(first.evaluation.result.metrics.mrr >= 0.9);
  assert.equal(first.decision.activatedModel.origin, "hercules-native");
  assert.equal(first.decision.activatedModel.state, "active");
});

test("native retriever produces sparse embeddings and relevant ranking", () => {
  const documents = [
    {id: "code", text: "debug software repository tests and code"},
    {id: "speech", text: "speech transcription audio and voice synthesis"},
    {id: "search", text: "document retrieval ranking search and memory"},
  ];
  const model = trainNativeRetriever(documents);
  const embedding = embedText(model, "search memory ranking");
  assert.ok(Object.keys(embedding).length > 0);

  const ranked = rerankDocuments(model, "find relevant memory documents", documents);
  assert.equal(ranked[0].id, "search");
  assert.ok(ranked[0].score > ranked[1].score);
});
