import http from "node:http";
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {HttpForgeInterpreter} from "../hercules-forge/interpreter.mjs";
import {createForgeControlService} from "../hercules-forge/control-api.mjs";

const token = "forge-prompt-test-token-123";

const spec = {
  version: "0.1",
  name: "PromptApp",
  description: "Generated from prompt.",
  entities: [
    {name: "Lead", fields: [{name: "name", type: "string", required: true}]},
  ],
  pages: [{name: "Leads", kind: "list", entity: "Lead"}],
  actions: [{name: "CreateLead", kind: "create", entity: "Lead"}],
};

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return "http://127.0.0.1:" + server.address().port;
}

test("HTTP interpreter uses the owned Forge prompt protocol", async () => {
  let received;
  const adapter = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    received = JSON.parse(body);
    res.writeHead(200, {"content-type": "application/json"});
    res.end(JSON.stringify({spec}));
  });

  const base = await listen(adapter);
  try {
    const interpreter = new HttpForgeInterpreter({endpoint: base + "/interpret"});
    const result = await interpreter.interpret("build a lead tracker");
    assert.equal(result.name, "PromptApp");
    assert.equal(received.protocol, "hercules-forge-interpreter/0.1");
    assert.equal(received.specVersion, "0.1");
    assert.equal(received.prompt, "build a lead tracker");
  } finally {
    await new Promise((resolve) => adapter.close(resolve));
  }
});

test("control API creates and revises projects through a replaceable prompt interpreter", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-prompt-"));
  const interpreter = {
    async interpret(prompt) {
      return {...structuredClone(spec), description: prompt};
    },
  };
  const server = createForgeControlService({root, token, interpreter});
  const base = await listen(server);

  async function post(path, body) {
    const response = await fetch(base + path, {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return {status: response.status, body: await response.json()};
  }

  try {
    const created = await post("/v1/projects/from-prompt", {
      prompt: "build my lead tracker",
      metadata: {projectId: "prompt-app"},
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.revision.spec.description, "build my lead tracker");
    assert.match(created.body.project.metadata.promptSha256, /^[a-f0-9]{64}$/);

    const revised = await post("/v1/projects/prompt-app/revisions/from-prompt", {
      prompt: "add a better lead workflow",
    });
    assert.equal(revised.status, 201);
    assert.equal(revised.body.spec.description, "add a better lead workflow");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, {recursive: true, force: true});
  }
});
