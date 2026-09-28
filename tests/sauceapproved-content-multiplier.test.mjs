import test from "node:test";
import assert from "node:assert/strict";
import {
  createContentDna,
  createVariationTree,
  addVariationBranch,
  evaluateVariantFatigue,
  findContentOpportunities,
  buildGenerationRequest,
  validateGeneratedAsset
} from "../sauceapproved-studio/content-multiplier/core.mjs";

test("Content DNA normalizes brand rules and preserves locked facts",()=>{
  const dna=createContentDna({
    brandId:"brand-1",
    vocabulary:["SauceApproved","premium"],
    bannedPhrases:["cheap"],
    audiences:["creators"],
    tone:["confident","clear"],
    lockedFacts:[{id:"price",value:"$49/month"}]
  });
  assert.equal(dna.brandId,"brand-1");
  assert.deepEqual(dna.vocabulary,["premium","SauceApproved"]);
  assert.equal(dna.lockedFacts[0].value,"$49/month");
  assert.throws(()=>{dna.lockedFacts.push({id:"x",value:"y"})},TypeError);
});

test("Variation Tree preserves lineage and rejects duplicate sibling branches",()=>{
  const tree=createVariationTree({
    projectId:"project-1",
    rootAsset:{id:"root",label:"Original",content:"One strong source idea"}
  });
  const branched=addVariationBranch({
    tree,
    parentId:"root",
    branch:{dimension:"hook",value:"problem-first",content:"Lead with the problem"}
  });
  assert.equal(branched.nodes.length,2);
  assert.equal(branched.nodes[1].parentId,"root");
  assert.equal(branched.nodes[1].lineage[0],"root");
  assert.throws(()=>addVariationBranch({
    tree:branched,
    parentId:"root",
    branch:{dimension:"hook",value:"problem-first",content:"Different wording"}
  }),/variation_branch_duplicate/);
});

test("Variant Fatigue Guard flags near-duplicate content and allows materially different angles",()=>{
  const existing=[
    {id:"a",content:"Turn one long video into five short social clips for your brand"}
  ];
  const tired=evaluateVariantFatigue({
    candidate:"Turn one long video into 5 short social clips for your brand",
    existing,
    threshold:0.7
  });
  assert.equal(tired.fatigued,true);
  assert.equal(tired.matchedId,"a");

  const fresh=evaluateVariantFatigue({
    candidate:"Use unanswered customer objections to create a new educational series",
    existing,
    threshold:0.7
  });
  assert.equal(fresh.fatigued,false);
});

test("Content Opportunity Radar surfaces unused source moments and locked brand facts",()=>{
  const opportunities=findContentOpportunities({
    sourceMoments:[
      {id:"m1",text:"Customer says setup only takes ten minutes",score:0.9},
      {id:"m2",text:"Founder explains the origin story",score:0.6}
    ],
    brandFacts:[
      {id:"f1",value:"30-day guarantee",locked:true},
      {id:"f2",value:"Ships in 2 business days",locked:true}
    ],
    usedEvidenceIds:["m2","f2"]
  });
  assert.deepEqual(opportunities.map(x=>x.id),["f1","m1"]);
});

test("Generation requests fail closed without a provider and carry Content DNA constraints when connected",async()=>{
  const dna=createContentDna({
    brandId:"brand-1",
    vocabulary:["SauceApproved"],
    bannedPhrases:["cheap"],
    lockedFacts:[{id:"offer",value:"30-day guarantee"}]
  });

  const unavailable=await buildGenerationRequest({
    source:{kind:"text",content:"A founder explains the product."},
    dna,
    platforms:["instagram","youtube"],
    goal:"awareness"
  });
  assert.deepEqual(unavailable,{ok:false,error:"generation_provider_unavailable"});

  let captured=null;
  const connected=await buildGenerationRequest({
    source:{kind:"text",content:"A founder explains the product."},
    dna,
    platforms:["instagram","youtube"],
    goal:"awareness",
    generator:async request=>{
      captured=request;
      return {
        assets:[
          {
            id:"ig-1",
            platform:"instagram",
            content:"SauceApproved includes a 30-day guarantee.",
            factBindings:{offer:"30-day guarantee"}
          },
          {
            id:"yt-1",
            platform:"youtube",
            content:"SauceApproved includes a 30-day guarantee.",
            factBindings:{offer:"30-day guarantee"}
          }
        ]
      };
    }
  });
  assert.equal(connected.ok,true);
  assert.equal(captured.constraints.bannedPhrases[0],"cheap");
  assert.equal(captured.constraints.lockedFacts[0].value,"30-day guarantee");
});

test("Generated assets are rejected when a locked fact binding drifts",()=>{
  const dna=createContentDna({
    brandId:"brand-1",
    lockedFacts:[{id:"offer",value:"30-day guarantee"}]
  });
  const result=validateGeneratedAsset({
    asset:{
      id:"asset-1",
      platform:"instagram",
      content:"Includes a guarantee.",
      factBindings:{offer:"14-day guarantee"}
    },
    dna
  });
  assert.equal(result.ok,false);
  assert.equal(result.error,"locked_fact_mismatch");
  assert.equal(result.factId,"offer");
});
