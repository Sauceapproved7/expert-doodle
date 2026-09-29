import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {runForgeStartupPromptCanary} from "../hercules-forge/startup-canary.mjs";

const controlToken = "c".repeat(48);

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return "http://127.0.0.1:" + server.address().port;
}

test("startup prompt canary proves create, reread, and durable readiness without exposing control token", async () => {
  const calls = [];
  let created = false;
  const server = http.createServer(async (req, res) => {
    calls.push({method:req.method,url:req.url,authorization:req.headers.authorization});
    if (req.headers.authorization !== "Bearer " + controlToken && req.url !== "/ready") {
      res.writeHead(401, {"content-type":"application/json"});
      return res.end(JSON.stringify({error:"unauthorized"}));
    }

    if (req.method === "GET" && req.url === "/v1/projects/forge-prompt-canary-ai-v1") {
      if (!created) {
        res.writeHead(404, {"content-type":"application/json"});
        return res.end(JSON.stringify({error:"not_found"}));
      }
      res.writeHead(200, {"content-type":"application/json"});
      return res.end(JSON.stringify({
        project:{
          projectId:"forge-prompt-canary-ai-v1",
          metadata:{
            source:"prompt",
            canary:"forge-startup-prompt-v1",
            purpose:"synthetic-production-certification",
            promptSha256:"a".repeat(64),
          },
        },
      }));
    }

    if (req.method === "POST" && req.url === "/v1/projects/from-prompt") {
      let text = "";
      for await (const chunk of req) text += chunk;
      const body = JSON.parse(text);
      assert.equal(body.metadata.projectId, "forge-prompt-canary-ai-v1");
      assert.equal(body.metadata.canary, "forge-startup-prompt-v1");
      assert.match(body.prompt, /minimal internal canary/i);
      created = true;
      res.writeHead(201, {"content-type":"application/json"});
      return res.end(JSON.stringify({
        project:{
          projectId:"forge-prompt-canary-ai-v1",
          metadata:{
            source:"prompt",
            canary:"forge-startup-prompt-v1",
            purpose:"synthetic-production-certification",
            promptSha256:"a".repeat(64),
          },
        },
        revision:{
          revisionId:"r1",
          spec:{
            version:"0.1",
            name:"ForgeCanary",
            description:"Synthetic canary.",
            entities:[{name:"Check",fields:[{name:"label",type:"string",required:true}]}],
            pages:[{name:"Checks",kind:"list",entity:"Check"}],
            actions:[{name:"CreateCheck",kind:"create",entity:"Check"}],
          },
        },
      }));
    }

    if (req.method === "GET" && req.url === "/ready") {
      res.writeHead(200, {"content-type":"application/json"});
      return res.end(JSON.stringify({
        ready:true,
        durableState:{
          ok:true,
          schema:"sauceapproved.hercules.forge.durable-state.v1",
          carriesCredentials:false,
          objectCount:7,
        },
      }));
    }

    res.writeHead(404, {"content-type":"application/json"});
    res.end(JSON.stringify({error:"not_found"}));
  });

  const origin = await listen(server);
  try {
    const result = await runForgeStartupPromptCanary({
      origin,
      controlToken,
      projectId:"forge-prompt-canary-ai-v1",
    });
    assert.equal(result.ok, true);
    assert.equal(result.status, "created_and_verified");
    assert.equal(result.projectId, "forge-prompt-canary-ai-v1");
    assert.equal(result.revisionId, "r1");
    assert.equal(result.durableObjectCount, 7);
    assert.equal(JSON.stringify(result).includes(controlToken), false);
    assert.equal(calls.filter((call) => call.method === "POST").length, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("startup prompt canary is idempotent only for a previously certified synthetic project", async () => {
  const certified = http.createServer((req, res) => {
    if (req.url === "/v1/projects/forge-prompt-canary-ai-v1") {
      res.writeHead(200, {"content-type":"application/json"});
      return res.end(JSON.stringify({
        project:{
          projectId:"forge-prompt-canary-ai-v1",
          metadata:{
            source:"prompt",
            canary:"forge-startup-prompt-v1",
            purpose:"synthetic-production-certification",
            promptSha256:"b".repeat(64),
          },
        },
      }));
    }
    if (req.url === "/ready") {
      res.writeHead(200, {"content-type":"application/json"});
      return res.end(JSON.stringify({
        ready:true,
        durableState:{
          ok:true,
          schema:"sauceapproved.hercules.forge.durable-state.v1",
          carriesCredentials:false,
          objectCount:3,
        },
      }));
    }
    res.writeHead(500, {"content-type":"application/json"});
    res.end(JSON.stringify({error:"unexpected"}));
  });

  const origin = await listen(certified);
  try {
    const result = await runForgeStartupPromptCanary({
      origin,
      controlToken,
      projectId:"forge-prompt-canary-ai-v1",
    });
    assert.equal(result.status, "already_verified");
    assert.equal(result.durableObjectCount, 3);
  } finally {
    await new Promise((resolve) => certified.close(resolve));
  }

  let fallbackCreated=false;
  let fallbackId=null;
  const collision = http.createServer(async (req, res) => {
    if (req.method==="GET" && req.url==="/v1/projects/forge-prompt-canary-ai-v1") {
      res.writeHead(200, {"content-type":"application/json"});
      return res.end(JSON.stringify({project:{projectId:"forge-prompt-canary-ai-v1",metadata:{source:"manual"}}}));
    }
    if (req.method==="GET" && req.url?.startsWith("/v1/projects/ForgeCanary_")) {
      fallbackId=decodeURIComponent(req.url.split("/").at(-1));
      if(!fallbackCreated){
        res.writeHead(404, {"content-type":"application/json"});
        return res.end(JSON.stringify({error:"not_found"}));
      }
      res.writeHead(200, {"content-type":"application/json"});
      return res.end(JSON.stringify({project:{projectId:fallbackId,metadata:{source:"prompt",canary:"forge-startup-prompt-v1",purpose:"synthetic-production-certification",promptSha256:"d".repeat(64)}}}));
    }
    if(req.method==="POST" && req.url==="/v1/projects/from-prompt"){
      let text=""; for await(const chunk of req) text+=chunk; const body=JSON.parse(text);
      fallbackId=body.metadata.projectId;
      assert.match(fallbackId,/^ForgeCanary_[a-f0-9]{20}$/);
      fallbackCreated=true;
      res.writeHead(201, {"content-type":"application/json"});
      return res.end(JSON.stringify({project:{projectId:fallbackId,metadata:{source:"prompt",canary:"forge-startup-prompt-v1",purpose:"synthetic-production-certification",promptSha256:"d".repeat(64)}},revision:{revisionId:"collision-safe-r1"}}));
    }
    if(req.url==="/ready"){
      res.writeHead(200, {"content-type":"application/json"});
      return res.end(JSON.stringify({ready:true,durableState:{ok:true,schema:"sauceapproved.hercules.forge.durable-state.v1",carriesCredentials:false,objectCount:5}}));
    }
    res.writeHead(404, {"content-type":"application/json"}); res.end(JSON.stringify({error:"not_found"}));
  });
  const collisionOrigin = await listen(collision);
  try {
    const result=await runForgeStartupPromptCanary({
      origin:collisionOrigin,
      controlToken,
      projectId:"forge-prompt-canary-ai-v1",
    });
    assert.equal(result.ok,true);
    assert.equal(result.collisionAvoided,true);
    assert.equal(result.configuredProjectId,"forge-prompt-canary-ai-v1");
    assert.equal(result.projectId,fallbackId);
    assert.equal(result.status,"created_and_verified");
  } finally {
    await new Promise((resolve) => collision.close(resolve));
  }
});

test("startup prompt canary validates server-only configuration", async () => {
  await assert.rejects(
    runForgeStartupPromptCanary({
      origin:"https://forge.example.test",
      controlToken:"short",
      projectId:"forge-prompt-canary-ai-v1",
    }),
    /at least 32/i,
  );
  await assert.rejects(
    runForgeStartupPromptCanary({
      origin:"file:///tmp/forge",
      controlToken,
      projectId:"forge-prompt-canary-ai-v1",
    }),
    /http or https/i,
  );
  await assert.rejects(
    runForgeStartupPromptCanary({
      origin:"https://forge.example.test",
      controlToken,
      projectId:"../escape",
    }),
    /projectId/i,
  );
});


test("startup canary reports safe internal stage code without leaking private error detail", async () => {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/v1/projects/forge-prompt-canary-ai-v1") {
      res.writeHead(404, {"content-type":"application/json"});
      return res.end(JSON.stringify({error:"not_found"}));
    }
    if (req.method === "POST" && req.url === "/v1/projects/from-prompt") {
      res.writeHead(500, {"content-type":"application/json"});
      return res.end(JSON.stringify({
        error:"internal_error",
        code:"forge_durable_flush_failed",
      }));
    }
    res.writeHead(404, {"content-type":"application/json"});
    res.end(JSON.stringify({error:"not_found"}));
  });

  const origin = await listen(server);
  try {
    await assert.rejects(
      runForgeStartupPromptCanary({
        origin,
        controlToken,
        projectId:"forge-prompt-canary-ai-v1",
      }),
      (error) => {
        assert.match(error.message, /forge_durable_flush_failed/);
        assert.doesNotMatch(error.message, /private|secret|token/i);
        return true;
      },
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});


test("startup prompt canary permits only one reserved collision fallback", async () => {
  let postCount=0;
  const server=http.createServer((req,res)=>{
    if(req.method==="GET" && req.url?.startsWith("/v1/projects/")){
      const projectId=decodeURIComponent(req.url.split("/").at(-1));
      res.writeHead(200,{"content-type":"application/json"});
      return res.end(JSON.stringify({project:{projectId,metadata:{source:"manual"}}}));
    }
    if(req.method==="POST" && req.url==="/v1/projects/from-prompt") postCount+=1;
    res.writeHead(404,{"content-type":"application/json"});
    res.end(JSON.stringify({error:"not_found"}));
  });
  const origin=await listen(server);
  try{
    await assert.rejects(
      runForgeStartupPromptCanary({origin,controlToken,projectId:"forge-prompt-canary-ai-v1"}),
      /collides with non-canary project/i,
    );
    assert.equal(postCount,0);
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
});


test("startup canary uses a fresh reserved identifier when the deterministic fallback is already occupied", async () => {
  let createdId=null;
  const occupied="ForgeCanary_a914b994697be8285386";
  const server=http.createServer(async (req,res)=>{
    if(req.method==="GET" && req.url==="/v1/projects/forge-prompt-canary-ai-v1"){
      res.writeHead(200,{"content-type":"application/json"});
      return res.end(JSON.stringify({project:{projectId:"forge-prompt-canary-ai-v1",metadata:{source:"manual"}}}));
    }
    if(req.method==="GET" && req.url==="/v1/projects/"+occupied){
      res.writeHead(200,{"content-type":"application/json"});
      return res.end(JSON.stringify({project:{projectId:occupied,metadata:{source:"manual"}}}));
    }
    if(req.method==="GET" && req.url?.startsWith("/v1/projects/ForgeCanary_")){
      const id=decodeURIComponent(req.url.split("/").at(-1));
      if(createdId===id){
        res.writeHead(200,{"content-type":"application/json"});
        return res.end(JSON.stringify({project:{projectId:id,metadata:{source:"prompt",canary:"forge-startup-prompt-v1",purpose:"synthetic-production-certification",promptSha256:"e".repeat(64)}}}));
      }
      res.writeHead(404,{"content-type":"application/json"});
      return res.end(JSON.stringify({error:"not_found"}));
    }
    if(req.method==="POST" && req.url==="/v1/projects/from-prompt"){
      let text=""; for await(const chunk of req) text+=chunk; const body=JSON.parse(text);
      createdId=body.metadata.projectId;
      assert.match(createdId,/^ForgeCanary_[a-f0-9]{20}$/);
      assert.notEqual(createdId,occupied);
      res.writeHead(201,{"content-type":"application/json"});
      return res.end(JSON.stringify({project:{projectId:createdId,metadata:{source:"prompt",canary:"forge-startup-prompt-v1",purpose:"synthetic-production-certification",promptSha256:"e".repeat(64)}},revision:{revisionId:"fresh-r1"}}));
    }
    if(req.url==="/ready"){
      res.writeHead(200,{"content-type":"application/json"});
      return res.end(JSON.stringify({ready:true,durableState:{ok:true,schema:"sauceapproved.hercules.forge.durable-state.v1",carriesCredentials:false,objectCount:6}}));
    }
    res.writeHead(404,{"content-type":"application/json"}); res.end(JSON.stringify({error:"not_found"}));
  });
  const origin=await listen(server);
  try{
    const result=await runForgeStartupPromptCanary({origin,controlToken,projectId:"forge-prompt-canary-ai-v1"});
    assert.equal(result.ok,true);
    assert.equal(result.collisionAvoided,true);
    assert.equal(result.status,"created_and_verified");
    assert.equal(result.projectId,createdId);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
