import test from "node:test";
import assert from "node:assert/strict";
import {createStudioHttpHandler} from "../hercules-video/studio-server.mjs";
import {buildCampaignPack} from "../sauceapproved-studio/campaign-forge/core.mjs";

test("Studio evaluates Campaign Forge evidence without publishing or mutation",async()=>{
  const pack=buildCampaignPack({title:"Launch",audience:"founders",promise:"proof",proof:"case",cta:"Start"});
  const metrics=Object.fromEntries(pack.outputs.map((o,i)=>[o.format,{impressions:100,clicks:20,conversions:i+1,spend:10,evidence:{impressions:true,clicks:true,conversions:true,spend:true}}]));
  const handle=createStudioHttpHandler();
  const response=await handle({method:"POST",pathname:"/api/studio/performance-brain/evaluate",body:JSON.stringify({pack,objective:"conversion_rate",metrics})});
  assert.equal(response.status,200);
  const body=JSON.parse(response.body);
  assert.equal(body.status,"verified_comparison");
  assert.equal(body.winner,"story-9x16");
  assert.equal(body.publishReady,false);
  assert.equal(body.outcomeLoop.automaticMutation,false);
});

test("Studio rejects invalid Performance Brain JSON",async()=>{
  const response=await createStudioHttpHandler()({method:"POST",pathname:"/api/studio/performance-brain/evaluate",body:"{"});
  assert.equal(response.status,400);
  assert.equal(JSON.parse(response.body).error,"invalid_json_body");
});
