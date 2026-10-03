import http from "node:http";
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {HerculesAiForgeInterpreter, HttpForgeInterpreter} from "../hercules-forge/interpreter.mjs";
import {createForgeControlService} from "../hercules-forge/control-api.mjs";

const token = "x".repeat(24);

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

test("HTTP interpreter refuses redirects and oversized responses", async () => {
  const target = http.createServer((req, res) => {
    res.writeHead(200, {"content-type": "application/json"});
    res.end(JSON.stringify({spec}));
  });
  const targetBase = await listen(target);

  const redirector = http.createServer((req, res) => {
    res.writeHead(302, {location: targetBase});
    res.end();
  });
  const redirectBase = await listen(redirector);

  const oversized = http.createServer((req, res) => {
    res.writeHead(200, {"content-type": "application/json"});
    res.end(JSON.stringify({spec: {...spec, description: "x".repeat(2048)}}));
  });
  const oversizedBase = await listen(oversized);

  try {
    await assert.rejects(
      new HttpForgeInterpreter({endpoint: redirectBase}).interpret("do not redirect me"),
    );

    await assert.rejects(
      new HttpForgeInterpreter({
        endpoint: oversizedBase,
        maxResponseBytes: 256,
      }).interpret("bounded response"),
      /response too large/,
    );
  } finally {
    await new Promise((resolve) => redirector.close(resolve));
    await new Promise((resolve) => target.close(resolve));
    await new Promise((resolve) => oversized.close(resolve));
  }
});

test("interpreter endpoint rejects unsafe schemes and embedded credentials", () => {
  assert.throws(
    () => new HttpForgeInterpreter({endpoint: "file:///tmp/model"}),
    /http or https/,
  );
  assert.throws(
    () => new HttpForgeInterpreter({endpoint: "https://user:pass@example.com/interpret"}),
    /must not embed credentials/,
  );
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
    assert.equal(created.body.project.metadata.prompt, undefined);

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


test("Hercules AI interpreter uses the internal router and returns a validated Forge spec", async () => {
  let received;
  let internalKey;
  const adapter = http.createServer(async (req, res) => {
    internalKey = req.headers["x-hercules-internal-key"];
    let body = "";
    for await (const chunk of req) body += chunk;
    received = JSON.parse(body);
    res.writeHead(200, {"content-type": "application/json"});
    res.end(JSON.stringify({
      ok: true,
      result: "\`\`\`json\n" + JSON.stringify(spec) + "\n\`\`\`",
      provider: "test-provider",
      model: "test-model",
    }));
  });

  const base = await listen(adapter);
  try {
    const interpreter = new HerculesAiForgeInterpreter({
      endpoint: base + "/route",
      internalKey: "k".repeat(48),
    });
    const result = await interpreter.interpret("build a lead tracker");
    assert.deepEqual(result, spec);
    assert.equal(internalKey, "k".repeat(48));
    assert.equal(received.action, "route_internal");
    assert.equal(received.prompt, "build a lead tracker");
    assert.match(received.system, /Forge spec/i);
    assert.match(received.system, /"version":"0\.1"/);
    assert.match(received.system, /string, number, boolean, datetime, json/);
    assert.match(received.system, /Return JSON only/i);
  } finally {
    await new Promise((resolve) => adapter.close(resolve));
  }
});

test("Hercules AI interpreter rejects malformed, invalid, redirected, and oversized model output", async () => {
  const invalidSpec = http.createServer((req, res) => {
    res.writeHead(200, {"content-type": "application/json"});
    res.end(JSON.stringify({
      ok: true,
      result: JSON.stringify({...spec, pages: [{name: "Leads", kind: "unknown", entity: "Lead"}]}),
    }));
  });
  const invalidBase = await listen(invalidSpec);

  const malformed = http.createServer((req, res) => {
    res.writeHead(200, {"content-type": "application/json"});
    res.end(JSON.stringify({ok: true, result: "not-json"}));
  });
  const malformedBase = await listen(malformed);

  const target = http.createServer((req, res) => {
    res.writeHead(200, {"content-type": "application/json"});
    res.end(JSON.stringify({ok: true, result: JSON.stringify(spec)}));
  });
  const targetBase = await listen(target);

  const redirector = http.createServer((req, res) => {
    res.writeHead(302, {location: targetBase});
    res.end();
  });
  const redirectBase = await listen(redirector);

  const oversized = http.createServer((req, res) => {
    res.writeHead(200, {"content-type": "application/json"});
    res.end(JSON.stringify({ok: true, result: JSON.stringify({...spec, description: "x".repeat(4096)})}));
  });
  const oversizedBase = await listen(oversized);

  try {
    await assert.rejects(
      new HerculesAiForgeInterpreter({
        endpoint: invalidBase,
        internalKey: "k".repeat(48),
      }).interpret("invalid spec"),
      /invalid Forge spec/i,
    );
    await assert.rejects(
      new HerculesAiForgeInterpreter({
        endpoint: malformedBase,
        internalKey: "k".repeat(48),
      }).interpret("malformed output"),
      /invalid JSON/i,
    );
    await assert.rejects(
      new HerculesAiForgeInterpreter({
        endpoint: redirectBase,
        internalKey: "k".repeat(48),
      }).interpret("do not redirect"),
    );
    await assert.rejects(
      new HerculesAiForgeInterpreter({
        endpoint: oversizedBase,
        internalKey: "k".repeat(48),
        maxResponseBytes: 256,
      }).interpret("bounded output"),
      /response too large/i,
    );
  } finally {
    await new Promise((resolve) => invalidSpec.close(resolve));
    await new Promise((resolve) => malformed.close(resolve));
    await new Promise((resolve) => redirector.close(resolve));
    await new Promise((resolve) => target.close(resolve));
    await new Promise((resolve) => oversized.close(resolve));
  }
});

test("Hercules AI interpreter rejects missing credentials and unsafe endpoint configuration", () => {
  assert.throws(
    () => new HerculesAiForgeInterpreter({
      endpoint: "https://models.example.test/route",
      internalKey: "short",
    }),
    /at least 32/i,
  );
  assert.throws(
    () => new HerculesAiForgeInterpreter({
      endpoint: "file:///tmp/model",
      internalKey: "k".repeat(48),
    }),
    /http or https/i,
  );
  assert.throws(
    () => new HerculesAiForgeInterpreter({
      endpoint: "https://user:pass@example.test/route",
      internalKey: "k".repeat(48),
    }),
    /must not embed credentials/i,
  );
});


test("Hercules AI interpreter repairs one invalid model generation before failing the build", async () => {
  const received = [];
  let attempt = 0;
  const adapter = http.createServer(async (req, res) => {
    let text = "";
    for await (const chunk of req) text += chunk;
    received.push(JSON.parse(text));
    attempt += 1;
    const result = attempt === 1
      ? JSON.stringify({
          version:"0.1",
          name:"CanaryApp",
          description:"First attempt has an invalid page kind.",
          entities:[{name:"Check",fields:[{name:"label",type:"string",required:true}]}],
          pages:[{name:"Checks",kind:"unknown",entity:"Check"}],
          actions:[{name:"CreateCheck",kind:"create",entity:"Check"}],
        })
      : JSON.stringify({
          version:"0.1",
          name:"CanaryApp",
          description:"Repaired canary app.",
          entities:[{name:"Check",fields:[{name:"label",type:"string",required:true}]}],
          pages:[{name:"Checks",kind:"list",entity:"Check"}],
          actions:[{name:"CreateCheck",kind:"create",entity:"Check"}],
        });
    res.writeHead(200, {"content-type":"application/json"});
    res.end(JSON.stringify({ok:true,result,provider:"test",model:"test"}));
  });

  const base = await listen(adapter);
  try {
    const interpreter = new HerculesAiForgeInterpreter({
      endpoint:base + "/route",
      internalKey:"k".repeat(48),
    });
    const repaired = await interpreter.interpret("build the production canary");
    assert.equal(repaired.name, "CanaryApp");
    assert.equal(repaired.pages[0].kind, "list");
    assert.equal(received.length, 2);
    assert.equal(received[0].prompt, "build the production canary");
    assert.match(received[1].prompt, /repair the previous Forge specification/i);
    assert.match(received[1].prompt, /unsupported page kind/i);
    assert.doesNotMatch(received[1].prompt, /authorization|internalKey|secret/i);
  } finally {
    await new Promise((resolve) => adapter.close(resolve));
  }
});

test("Hercules AI interpreter remains fail closed after one bounded repair attempt", async () => {
  let calls = 0;
  const adapter = http.createServer(async (req, res) => {
    calls += 1;
    res.writeHead(200, {"content-type":"application/json"});
    res.end(JSON.stringify({
      ok:true,
      result:JSON.stringify({
        version:"0.1",
        name:"StillInvalid",
        description:"Still invalid.",
        entities:[{name:"Check",fields:[{name:"label",type:"string",required:true}]}],
        pages:[{name:"Checks",kind:"unknown",entity:"Check"}],
        actions:[{name:"CreateCheck",kind:"create",entity:"Check"}],
      }),
    }));
  });
  const base = await listen(adapter);
  try {
    await assert.rejects(
      new HerculesAiForgeInterpreter({
        endpoint:base + "/route",
        internalKey:"k".repeat(48),
      }).interpret("build invalid twice"),
      /invalid Forge spec/i,
    );
    assert.equal(calls, 2);
  } finally {
    await new Promise((resolve) => adapter.close(resolve));
  }
});

test("Hercules AI interpreter safely normalizes omitted top-level metadata before model repair", async () => {
  let calls=0;
  const adapter=http.createServer((req,res)=>{
    calls+=1;
    res.writeHead(200,{"content-type":"application/json"});
    res.end(JSON.stringify({
      ok:true,
      result:"\`\`\`json\n"+JSON.stringify({
        entities:[{name:"Check",fields:[{name:"label",type:"string",required:true}]}],
        pages:[{name:"CheckList",kind:"list",entity:"Check",fields:["label"]}],
        actions:[{name:"CreateCheck",kind:"create",entity:"Check",fields:["label"]}]
      })+"\n\`\`\`"
    }));
  });
  const base=await listen(adapter);
  try{
    const interpreter=new HerculesAiForgeInterpreter({endpoint:base+"/route",internalKey:"k".repeat(48)});
    const result=await interpreter.interpret("build the production canary");
    assert.equal(result.version,"0.1");
    assert.equal(result.name,"CheckApp");
    assert.match(result.description,/Forge prompt/i);
    assert.equal(result.pages[0].kind,"list");
    assert.equal(result.actions[0].kind,"create");
    assert.equal(calls,1);
  } finally {
    await new Promise((resolve)=>adapter.close(resolve));
  }
});
