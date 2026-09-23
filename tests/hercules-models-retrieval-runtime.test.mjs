import test from "node:test";
import assert from "node:assert/strict";
import {HERCULES_MODEL_SLOTS} from "../hercules-models/catalog.mjs";
import {
  HERCULES_RETRIEVAL_CHECKPOINT_SHA256,
  HerculesEmbeddedRetrieval,
} from "../hercules-models/embedded-retrieval.mjs";
import {createModelPlaneService} from "../hercules-models/service.mjs";

const token = "q".repeat(24);

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return "http://127.0.0.1:" + server.address().port;
}

test("embedded Hercules Retrieval reconstructs the attested checkpoint", async () => {
  const runtime = await HerculesEmbeddedRetrieval.load();

  const embedding = runtime.infer(
    {text: "memory document ranking and search"},
    {task: "embedding"},
  );
  assert.equal(
    embedding.checkpoint,
    "sha256:" + HERCULES_RETRIEVAL_CHECKPOINT_SHA256,
  );
  assert.equal(embedding.modelId, "hercules-retrieval");
  assert.ok(Object.keys(embedding.vector).length > 0);

  const reranked = runtime.infer({
    query: "find memory search ranking",
    documents: [
      {id: "speech", text: "speech audio transcription voice synthesis"},
      {id: "memory", text: "memory search document ranking retrieval"},
    ],
  }, {task: "rerank"});
  assert.equal(reranked.ranking[0].id, "memory");
});

test("model plane serves native retrieval embedding and reranking", async () => {
  const retrieval = await HerculesEmbeddedRetrieval.load();
  const server = createModelPlaneService({
    models: HERCULES_MODEL_SLOTS,
    token,
    embeddedRuntimes: {
      "hercules-retrieval": retrieval,
    },
  });
  const base = await listen(server);

  try {
    const embedResponse = await fetch(base + "/v1/infer", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        task: "embedding",
        input: {text: "checkpoint lineage and artifact hash"},
      }),
    });
    assert.equal(embedResponse.status, 200);
    const embedBody = await embedResponse.json();
    assert.equal(embedBody.model.id, "hercules-retrieval");
    assert.ok(Object.keys(embedBody.output.vector).length > 0);

    const rankResponse = await fetch(base + "/v1/infer", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        task: "rerank",
        input: {
          query: "which document is about training provenance",
          documents: [
            {id: "deploy", text: "deployment rollback and release artifacts"},
            {id: "training", text: "dataset provenance license rights training evidence"},
          ],
        },
      }),
    });
    assert.equal(rankResponse.status, 200);
    const rankBody = await rankResponse.json();
    assert.equal(rankBody.output.ranking[0].id, "training");
    assert.equal(
      rankBody.model.checkpoint,
      "sha256:" + HERCULES_RETRIEVAL_CHECKPOINT_SHA256,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("retrieval inference fails closed when its embedded runtime is absent", async () => {
  const server = createModelPlaneService({
    models: HERCULES_MODEL_SLOTS,
    token,
    embeddedRuntimes: {},
  });
  const base = await listen(server);

  try {
    const response = await fetch(base + "/v1/infer", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        task: "rerank",
        input: {
          query: "memory search",
          documents: [{id: "one", text: "memory search"}],
        },
      }),
    });
    assert.equal(response.status, 503);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
