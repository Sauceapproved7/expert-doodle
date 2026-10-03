import test from "node:test";
import assert from "node:assert/strict";
import {buildCampaignPack} from "../sauceapproved-studio/campaign-forge/core.mjs";
import {buildCampaignPerformanceInput,evaluateCampaignPerformance} from "../sauceapproved-studio/performance-brain/core.mjs";

test("Campaign Forge output enters Performance Brain without inventing evidence",()=>{
  const pack=buildCampaignPack({title:"Launch",audience:"founders",promise:"faster proof",proof:"verified case",cta:"Start"});
  const input=buildCampaignPerformanceInput(pack,{objective:"conversion_rate",metrics:{
    "hero-15":{impressions:100,clicks:20,conversions:4,spend:10,evidence:{impressions:true,clicks:true,conversions:true,spend:true}},
    "reel-9x16":{impressions:100,clicks:25,conversions:8,spend:12,evidence:{impressions:true,clicks:true,conversions:true,spend:true}}
  }});
  assert.equal(input.campaignDna.audience,"founders");
  assert.equal(input.variants.length,4);
  const result=evaluateCampaignPerformance(input);
  assert.equal(result.status,"insufficient_verified_evidence");
  assert.equal(result.winner,null);
  assert.equal(result.publishReady,false);
  assert.equal(result.outcomeLoop.automaticMutation,false);
});

test("Campaign Performance adapter preserves verified evidence and can compare complete variants",()=>{
  const pack=buildCampaignPack({title:"Launch",audience:"founders",promise:"faster proof",proof:"verified case",cta:"Start"});
  const metrics=Object.fromEntries(pack.outputs.map((o,i)=>[o.format,{impressions:100,clicks:20,conversions:i+1,spend:10,evidence:{impressions:true,clicks:true,conversions:true,spend:true}}]));
  const result=evaluateCampaignPerformance(buildCampaignPerformanceInput(pack,{objective:"conversion_rate",metrics}));
  assert.equal(result.status,"verified_comparison");
  assert.equal(result.winner,"story-9x16");
  assert.equal(result.publishReady,false);
});
