import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {HerculesBotDeployTargetAdapter} from "../hercules-deploy/hercules-bot-adapter.mjs";

const req={serviceId:"hercules-bot",releaseId:"r1",sourceCommit:"a".repeat(40),artifactFingerprint:"b".repeat(64),publicOrigin:"https://bot.example.test",target:{kind:"hercules_bot_local",reference:"BOT_TARGET"},metadata:{}};

test("bot target deploy writes a release manifest into an owner-provided target directory",async()=>{
 const root=await mkdtemp(join(tmpdir(),"hercules-bot-target-"));
 try{
  const adapter=new HerculesBotDeployTargetAdapter({allowedRoot:root});
  const target={...req,target:{kind:"hercules_bot_local",reference:"bot-app"}};
  const result=await adapter.deploy({deploymentId:"d1",request:target});
  assert.equal(result.verifiedReady,false);
  const manifest=JSON.parse(await readFile(join(root,"bot-app","hercules-release.json"),"utf8"));
  assert.equal(manifest.releaseId,"r1");
  assert.equal(manifest.serviceId,"hercules-bot");
 } finally {await rm(root,{recursive:true,force:true});}
});

test("bot target verification requires the matching deployment manifest",async()=>{
 const root=await mkdtemp(join(tmpdir(),"hercules-bot-target-"));
 try{
  const adapter=new HerculesBotDeployTargetAdapter({allowedRoot:root});
  const target={...req,target:{kind:"hercules_bot_local",reference:"bot-app"}};
  await adapter.deploy({deploymentId:"d1",request:target});
  const verified=await adapter.verify({deploymentId:"d1",request:target});
  assert.equal(verified.verified,true);
  assert.equal(verified.runtimeMode,"software-only");
 } finally {await rm(root,{recursive:true,force:true});}
});

test("bot target rejects traversal outside its allowed root",async()=>{
 const root=await mkdtemp(join(tmpdir(),"hercules-bot-target-"));
 try{
  const adapter=new HerculesBotDeployTargetAdapter({allowedRoot:root});
  await assert.rejects(adapter.deploy({deploymentId:"d1",request:{...req,target:{kind:"hercules_bot_local",reference:"../escape"}}}),/target reference/);
 } finally {await rm(root,{recursive:true,force:true});}
});
