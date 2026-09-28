import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {createHash} from "node:crypto";
import {mkdtemp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {ForgeDurableStateMirror} from "../hercules-forge/durable-state.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const token = "d".repeat(48);

function startStateFixture() {
  const chunks = new Map();
  const objects = new Map();

  const server = http.createServer(async (req, res) => {
    if (req.headers["x-hercules-forge-state-key"] !== token) {
      res.writeHead(401, {"content-type":"application/json"});
      return res.end(JSON.stringify({error:"unauthorized"}));
    }
    let text = "";
    for await (const chunk of req) text += chunk;
    const body = text ? JSON.parse(text) : {};
    const key = (path, index) => path + "#" + index;

    if (body.action === "forge_state_manifest") {
      res.writeHead(200, {"content-type":"application/json"});
      return res.end(JSON.stringify({ok:true, objects:[...objects.values()]}));
    }
    if (body.action === "forge_state_put_chunk") {
      const raw = Buffer.from(body.contentBase64, "base64");
      if (raw.byteLength !== body.bytes || sha256(raw) !== body.sha256) {
        res.writeHead(409, {"content-type":"application/json"});
        return res.end(JSON.stringify({error:"chunk_integrity"}));
      }
      chunks.set(key(body.path, body.index), {
        path:body.path,index:body.index,bytes:body.bytes,sha256:body.sha256,
        contentBase64:body.contentBase64,
      });
      res.writeHead(200, {"content-type":"application/json"});
      return res.end(JSON.stringify({ok:true}));
    }
    if (body.action === "forge_state_commit_object") {
      let total = 0;
      for (let i = 0; i < body.chunks; i++) {
        const chunk = chunks.get(key(body.path, i));
        if (!chunk) {
          res.writeHead(409, {"content-type":"application/json"});
          return res.end(JSON.stringify({error:"missing_chunk"}));
        }
        total += chunk.bytes;
      }
      if (total !== body.bytes) {
        res.writeHead(409, {"content-type":"application/json"});
        return res.end(JSON.stringify({error:"object_size"}));
      }
      objects.set(body.path, {
        path:body.path,sha256:body.sha256,bytes:body.bytes,chunks:body.chunks,
      });
      for (const chunkKey of [...chunks.keys()]) {
        if (chunkKey.startsWith(body.path + "#")) {
          const index = Number(chunkKey.slice(chunkKey.lastIndexOf("#") + 1));
          if (index >= body.chunks) chunks.delete(chunkKey);
        }
      }
      res.writeHead(200, {"content-type":"application/json"});
      return res.end(JSON.stringify({ok:true}));
    }
    if (body.action === "forge_state_get_chunk") {
      const chunk = chunks.get(key(body.path, body.index));
      if (!chunk) {
        res.writeHead(404, {"content-type":"application/json"});
        return res.end(JSON.stringify({error:"not_found"}));
      }
      res.writeHead(200, {"content-type":"application/json"});
      return res.end(JSON.stringify({ok:true, chunk}));
    }
    if (body.action === "forge_state_delete_object") {
      objects.delete(body.path);
      for (const chunkKey of [...chunks.keys()]) {
        if (chunkKey.startsWith(body.path + "#")) chunks.delete(chunkKey);
      }
      res.writeHead(200, {"content-type":"application/json"});
      return res.end(JSON.stringify({ok:true}));
    }
    if (body.action === "forge_state_status") {
      res.writeHead(200, {"content-type":"application/json"});
      return res.end(JSON.stringify({ok:true, objectCount:objects.size}));
    }
    res.writeHead(400, {"content-type":"application/json"});
    res.end(JSON.stringify({error:"unknown_action"}));
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        server,
        endpoint:"http://127.0.0.1:" + server.address().port,
        objects,
        chunks,
      });
    });
  });
}

test("durable state mirror flushes only managed Forge state and hydrates it with integrity verification", async () => {
  const remote = await startStateFixture();
  const sourceRoot = await mkdtemp(join(tmpdir(), "forge-durable-source-"));
  const restoredRoot = await mkdtemp(join(tmpdir(), "forge-durable-restored-"));
  try {
    await mkdir(join(sourceRoot, "projects", "p1"), {recursive:true});
    await mkdir(join(sourceRoot, "identity", "users"), {recursive:true});
    await mkdir(join(sourceRoot, "artifacts", "ignore-me"), {recursive:true});
    await writeFile(join(sourceRoot, "projects", "p1", "project.json"), JSON.stringify({projectId:"p1"}), "utf8");
    await writeFile(join(sourceRoot, "identity", "users", "u1.json"), JSON.stringify({userId:"u1"}), "utf8");
    await writeFile(join(sourceRoot, "artifacts", "ignore-me", "artifact.json"), "not durable", "utf8");

    const mirror = new ForgeDurableStateMirror({
      root:sourceRoot,
      endpoint:remote.endpoint,
      token,
      chunkBytes:16,
    });
    const flushed = await mirror.flush();
    assert.equal(flushed.verified, true);
    assert.deepEqual([...remote.objects.keys()].sort(), [
      "identity/users/u1.json",
      "projects/p1/project.json",
    ]);

    const restored = new ForgeDurableStateMirror({
      root:restoredRoot,
      endpoint:remote.endpoint,
      token,
      chunkBytes:16,
    });
    const hydrated = await restored.hydrate();
    assert.equal(hydrated.verified, true);
    assert.deepEqual(
      JSON.parse(await readFile(join(restoredRoot, "projects", "p1", "project.json"), "utf8")),
      {projectId:"p1"},
    );
    assert.deepEqual(
      JSON.parse(await readFile(join(restoredRoot, "identity", "users", "u1.json"), "utf8")),
      {userId:"u1"},
    );
  } finally {
    await new Promise((resolve) => remote.server.close(resolve));
    await Promise.all([
      rm(sourceRoot, {recursive:true, force:true}),
      rm(restoredRoot, {recursive:true, force:true}),
    ]);
  }
});

test("durable state mirror removes remote objects deleted locally", async () => {
  const remote = await startStateFixture();
  const root = await mkdtemp(join(tmpdir(), "forge-durable-delete-"));
  try {
    await mkdir(join(root, "releases", "p1"), {recursive:true});
    const file = join(root, "releases", "p1", "active.json");
    await writeFile(file, JSON.stringify({revisionId:"r1"}), "utf8");
    const mirror = new ForgeDurableStateMirror({root,endpoint:remote.endpoint,token,chunkBytes:16});
    await mirror.flush();
    assert.equal(remote.objects.has("releases/p1/active.json"), true);

    await rm(file);
    await mirror.flush();
    assert.equal(remote.objects.has("releases/p1/active.json"), false);
  } finally {
    await new Promise((resolve) => remote.server.close(resolve));
    await rm(root, {recursive:true, force:true});
  }
});

test("durable state hydrate fails closed on corrupted remote chunks", async () => {
  const remote = await startStateFixture();
  const root = await mkdtemp(join(tmpdir(), "forge-durable-corrupt-"));
  const restoredRoot = await mkdtemp(join(tmpdir(), "forge-durable-corrupt-restored-"));
  try {
    await mkdir(join(root, "audit"), {recursive:true});
    await writeFile(join(root, "audit", "head.json"), JSON.stringify({lastSequence:1}), "utf8");
    const mirror = new ForgeDurableStateMirror({root,endpoint:remote.endpoint,token,chunkBytes:8});
    await mirror.flush();

    const firstKey = [...remote.chunks.keys()][0];
    const original = remote.chunks.get(firstKey);
    remote.chunks.set(firstKey, {...original, contentBase64:Buffer.from("corrupt").toString("base64")});

    const restored = new ForgeDurableStateMirror({
      root:restoredRoot,
      endpoint:remote.endpoint,
      token,
      chunkBytes:8,
    });
    await assert.rejects(() => restored.hydrate(), /chunk integrity mismatch/i);
  } finally {
    await new Promise((resolve) => remote.server.close(resolve));
    await Promise.all([
      rm(root, {recursive:true, force:true}),
      rm(restoredRoot, {recursive:true, force:true}),
    ]);
  }
});

test("durable state endpoint validation is fail closed", () => {
  assert.throws(
    () => new ForgeDurableStateMirror({root:"/tmp/forge",endpoint:"http://example.com",token}),
    /https unless it is loopback/i,
  );
  assert.throws(
    () => new ForgeDurableStateMirror({root:"/tmp/forge",endpoint:"https://example.com",token:"short"}),
    /at least 32/i,
  );
});
