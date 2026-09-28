import assert from "node:assert/strict";
import test from "node:test";
import {
  createApprovedSalesKnowledge,
  createAdaptivePitchMemory,
  updateAdaptivePitchMemory,
  recommendFromApprovedKnowledge,
  recordObjection,
  buildObjectionIntelligenceMap,
  evaluateHandoffDecision,
  captureLead,
  buildObjectionContentBrief,
  executeApprovedAction,
  createSalesAgentManifest
} from "../sauceapproved-studio/ai-sales-agent/core.mjs";

function knowledge(){
  return createApprovedSalesKnowledge({
    brandId:"brand-1",
    products:[
      {id:"hoodie-black",name:"Black Hoodie",priceCents:7900,tags:["hoodie","black","streetwear"],active:true},
      {id:"hoodie-gray",name:"Sports Gray Hoodie",priceCents:7900,tags:["hoodie","gray","streetwear"],active:true}
    ],
    facts:[
      {id:"returns",value:"Returns accepted within 30 days",locked:true},
      {id:"shipping",value:"Standard shipping estimates are shown at checkout",locked:true}
    ],
    faqs:[{id:"sizes",question:"What sizes are offered?",answer:"Use the current product page for available sizes."}]
  });
}

test("approved sales knowledge normalizes products and locks business facts",()=>{
  const store=knowledge();
  assert.equal(store.brandId,"brand-1");
  assert.equal(store.products.length,2);
  assert.equal(store.facts[0].locked,true);
  assert.throws(()=>store.products.push({}),TypeError);
});

test("Adaptive Pitch Memory stores only explicitly stated non-sensitive sales context",()=>{
  let memory=createAdaptivePitchMemory({sessionId:"session-1"});
  memory=updateAdaptivePitchMemory({
    memory,
    explicit:{
      budgetRange:"under 100",
      desiredOutcome:"warm streetwear hoodie",
      priorities:["comfort","black color"],
      statedPreferences:["black"],
      objections:["shipping timing"],
      religion:"private",
      healthCondition:"private",
      politicalPreference:"private"
    }
  });
  assert.equal(memory.budgetRange,"under 100");
  assert.deepEqual(memory.priorities,["comfort","black color"]);
  assert.deepEqual(memory.statedPreferences,["black"]);
  assert.equal("religion" in memory,false);
  assert.equal("healthCondition" in memory,false);
  assert.equal("politicalPreference" in memory,false);
});

test("recommendations are grounded only in approved active products",()=>{
  const result=recommendFromApprovedKnowledge({
    knowledge:knowledge(),
    memory:updateAdaptivePitchMemory({
      memory:createAdaptivePitchMemory({sessionId:"s"}),
      explicit:{budgetRange:"under 100",statedPreferences:["black"],desiredOutcome:"hoodie"}
    })
  });
  assert.equal(result.ok,true);
  assert.equal(result.recommendations[0].productId,"hoodie-black");
  assert.equal(result.recommendations[0].priceCents,7900);
  assert.equal(result.source,"approved-knowledge");
});

test("recommendation fails safely when approved knowledge cannot support a match",()=>{
  const result=recommendFromApprovedKnowledge({
    knowledge:knowledge(),
    memory:updateAdaptivePitchMemory({
      memory:createAdaptivePitchMemory({sessionId:"s"}),
      explicit:{desiredOutcome:"running shoes"}
    })
  });
  assert.deepEqual(result,{ok:false,error:"approved_knowledge_insufficient",handoffRecommended:true});
});

test("Objection Intelligence Map clusters recurring buyer friction without sensitive traits",()=>{
  const events=[
    recordObjection({sessionId:"1",text:"Shipping is too slow",category:"shipping",source:"explicit-customer"}),
    recordObjection({sessionId:"2",text:"When will this arrive?",category:"shipping",source:"explicit-customer"}),
    recordObjection({sessionId:"3",text:"Price feels high",category:"price",source:"explicit-customer"})
  ];
  const map=buildObjectionIntelligenceMap({events});
  assert.equal(map.totalEvents,3);
  assert.equal(map.clusters[0].category,"shipping");
  assert.equal(map.clusters[0].count,2);
  assert.equal("race" in map.clusters[0],false);
  assert.equal("religion" in map.clusters[0],false);
});

test("Confidence-to-Handoff Governor escalates weak or risky answers with an auditable reason",()=>{
  const low=evaluateHandoffDecision({
    knowledgeSupport:0.35,
    factLockCoverage:0.4,
    ambiguity:0.8,
    actionRisk:"high"
  });
  assert.equal(low.decision,"handoff");
  assert.match(low.reason,/risk|support|ambiguity/);

  const strong=evaluateHandoffDecision({
    knowledgeSupport:0.98,
    factLockCoverage:1,
    ambiguity:0.05,
    actionRisk:"low"
  });
  assert.equal(strong.decision,"answer");
});

test("lead capture is consent-gated and does not store data without explicit consent",()=>{
  const denied=captureLead({consent:false,lead:{email:"buyer@example.com",name:"Buyer"}});
  assert.deepEqual(denied,{ok:false,error:"lead_consent_required"});

  const accepted=captureLead({consent:true,lead:{email:"buyer@example.com",name:"Buyer"}});
  assert.equal(accepted.ok,true);
  assert.equal(accepted.lead.email,"buyer@example.com");
});

test("Objection-to-Asset Bridge turns approved objection clusters into reviewable content briefs",()=>{
  const map=buildObjectionIntelligenceMap({
    events:[
      recordObjection({sessionId:"1",text:"How long does shipping take?",category:"shipping",source:"explicit-customer"}),
      recordObjection({sessionId:"2",text:"Shipping timing worries me",category:"shipping",source:"explicit-customer"})
    ]
  });
  const brief=buildObjectionContentBrief({cluster:map.clusters[0],brandId:"brand-1"});
  assert.equal(brief.status,"review-required");
  assert.equal(brief.brandId,"brand-1");
  assert.equal(brief.objectionCategory,"shipping");
  assert.match(brief.goal,/objection/i);
});

test("approved actions fail closed without a configured action adapter",async()=>{
  const result=await executeApprovedAction({
    action:"book_meeting",
    allowedActions:["book_meeting"],
    payload:{slot:"2026-10-01T14:00:00"},
    adapter:null
  });
  assert.deepEqual(result,{ok:false,error:"sales_action_adapter_unavailable"});
});

test("approved actions reject anything outside the explicit allowlist",async()=>{
  const result=await executeApprovedAction({
    action:"issue_refund",
    allowedActions:["book_meeting"],
    payload:{},
    adapter:async()=>({ok:true})
  });
  assert.deepEqual(result,{ok:false,error:"sales_action_not_allowed"});
});

test("AI Sales Agent manifest exposes fail-closed policy and Hercules differentiators",()=>{
  const manifest=createSalesAgentManifest();
  assert.equal(manifest.product,"SauceApproved AI Sales Agent");
  assert.equal(manifest.executionPolicy,"fail-closed");
  assert.equal(manifest.actionAdapterRequired,true);
  assert.ok(manifest.differentiators.includes("Objection Intelligence Map"));
  assert.ok(manifest.differentiators.includes("Adaptive Pitch Memory"));
  assert.ok(manifest.differentiators.includes("Confidence-to-Handoff Governor"));
  assert.ok(manifest.differentiators.includes("Objection-to-Asset Bridge"));
});
