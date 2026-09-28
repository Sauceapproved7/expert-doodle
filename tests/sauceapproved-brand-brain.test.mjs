import assert from "node:assert/strict";
import test from "node:test";
import {
  createBrandKnowledge,
  proposeBrandFactChange,
  createBrandConstitution,
  resolveBrandRule,
  inheritBrandConstitution,
  simulateCrossChannelConsistency,
  createRuleBlastRadiusPreview,
  compareBrandConstitutionVersions,
  createBrandBrainManifest
} from "../sauceapproved-studio/brand-brain/core.mjs";

function knowledge(){
  return createBrandKnowledge({
    brandId:"brand-root",
    sources:[
      {id:"source-site",type:"website",label:"Approved website"},
      {id:"source-policy",type:"policy",label:"Approved policy"}
    ],
    facts:[
      {id:"price-hoodie",value:"79.00",locked:true,sourceId:"source-site"},
      {id:"returns",value:"Returns accepted within 30 days",locked:true,sourceId:"source-policy"},
      {id:"tone",value:"premium streetwear",locked:false,sourceId:"source-site"}
    ]
  });
}

test("brand knowledge preserves provenance and freezes approved facts",()=>{
  const store=knowledge();
  assert.equal(store.brandId,"brand-root");
  assert.equal(store.facts[0].sourceId,"source-website".replace("website","site"));
  assert.throws(()=>store.facts.push({}),TypeError);
});

test("locked facts cannot be silently overwritten and conflicting proposals require review",()=>{
  const result=proposeBrandFactChange({
    knowledge:knowledge(),
    fact:{id:"price-hoodie",value:"59.00",sourceId:"source-site"}
  });
  assert.equal(result.status,"review-required");
  assert.equal(result.conflict,true);
  assert.equal(result.currentValue,"79.00");
  assert.equal(result.proposedValue,"59.00");
  assert.equal(result.autoApplied,false);
});

test("non-conflicting unlocked fact proposals still remain reviewable rather than auto-learning",()=>{
  const result=proposeBrandFactChange({
    knowledge:knowledge(),
    fact:{id:"tone",value:"premium Brooklyn streetwear",sourceId:"source-site"}
  });
  assert.equal(result.status,"review-required");
  assert.equal(result.conflict,false);
  assert.equal(result.autoApplied,false);
});

test("Brand Constitution resolves hard-rule precedence over soft preference and channel override over global",()=>{
  const constitution=createBrandConstitution({
    brandId:"brand-root",
    version:3,
    rules:[
      {id:"voice-soft",kind:"preference",scope:"global",key:"tone",value:"playful",priority:10},
      {id:"voice-hard",kind:"hard",scope:"global",key:"tone",value:"premium",priority:20},
      {id:"ig-tone",kind:"hard",scope:"channel:instagram",key:"tone",value:"premium-energetic",priority:30}
    ]
  });
  assert.equal(resolveBrandRule({constitution,key:"tone",channel:"email"}).value,"premium");
  assert.equal(resolveBrandRule({constitution,key:"tone",channel:"instagram"}).value,"premium-energetic");
});

test("Brand Constitution rejects conflicting active hard rules at identical precedence",()=>{
  assert.throws(()=>createBrandConstitution({
    brandId:"brand-root",
    rules:[
      {id:"a",kind:"hard",scope:"global",key:"cta",value:"Shop now",priority:20},
      {id:"b",kind:"hard",scope:"global",key:"cta",value:"Book now",priority:20}
    ]
  }),/brand_rule_conflict/);
});

test("multi-brand inheritance applies parent rules but permits explicit child overrides",()=>{
  const parent=createBrandConstitution({
    brandId:"parent",
    version:1,
    rules:[
      {id:"parent-tone",kind:"hard",scope:"global",key:"tone",value:"premium",priority:20},
      {id:"parent-disclosure",kind:"hard",scope:"global",key:"disclosure",value:"Terms apply",priority:20}
    ]
  });
  const child=inheritBrandConstitution({
    parent,
    childBrandId:"child",
    childRules:[
      {id:"child-tone",kind:"hard",scope:"global",key:"tone",value:"premium-youth",priority:30,overrides:"parent-tone"}
    ]
  });
  assert.equal(resolveBrandRule({constitution:child,key:"tone"}).value,"premium-youth");
  assert.equal(resolveBrandRule({constitution:child,key:"disclosure"}).value,"Terms apply");
  assert.equal(child.parentBrandId,"parent");
});

test("cross-channel consistency simulator detects price, CTA and disclosure contradictions without rewriting them",()=>{
  const result=simulateCrossChannelConsistency({
    assets:[
      {id:"email",channel:"email",price:"79.00",cta:"Shop now",disclosure:"Terms apply"},
      {id:"instagram",channel:"instagram",price:"69.00",cta:"Buy today",disclosure:""}
    ]
  });
  assert.equal(result.ok,false);
  assert.ok(result.inconsistencies.some(item=>item.field==="price"));
  assert.ok(result.inconsistencies.some(item=>item.field==="cta"));
  assert.ok(result.inconsistencies.some(item=>item.field==="disclosure"));
  assert.equal(result.autoCorrected,false);
});

test("Rule Blast Radius Preview reports downstream dependencies before rule activation",()=>{
  const preview=createRuleBlastRadiusPreview({
    proposedRule:{id:"new-price-rule",key:"price",value:"89.00"},
    dependencies:[
      {type:"asset",id:"asset-1",ruleIds:["old-price-rule"]},
      {type:"agent",id:"agent-1",ruleIds:["new-price-rule"]},
      {type:"campaign",id:"campaign-1",keys:["price"]}
    ]
  });
  assert.equal(preview.requiresReview,true);
  assert.deepEqual(preview.affected.map(item=>item.id).sort(),["agent-1","campaign-1"]);
});

test("Brand Drift Time Machine compares Constitution versions and judges the same asset under both",()=>{
  const from=createBrandConstitution({
    brandId:"brand-root",version:1,
    rules:[{id:"tone-v1",kind:"hard",scope:"global",key:"tone",value:"premium",priority:20}]
  });
  const to=createBrandConstitution({
    brandId:"brand-root",version:2,
    rules:[{id:"tone-v2",kind:"hard",scope:"global",key:"tone",value:"premium-energetic",priority:20}]
  });
  const result=compareBrandConstitutionVersions({
    from,to,
    asset:{id:"asset-1",channel:"instagram",attributes:{tone:"premium"}}
  });
  assert.equal(result.fromVersion,1);
  assert.equal(result.toVersion,2);
  assert.equal(result.fromJudgment.compliant,true);
  assert.equal(result.toJudgment.compliant,false);
  assert.ok(result.changedKeys.includes("tone"));
});

test("Brand Brain manifest exposes fail-closed governance and Hercules differentiators",()=>{
  const manifest=createBrandBrainManifest();
  assert.equal(manifest.product,"SauceApproved Brand Brain");
  assert.equal(manifest.executionPolicy,"approval-gated");
  assert.equal(manifest.silentAutoLearningAllowed,false);
  assert.ok(manifest.differentiators.includes("Brand Constitution"));
  assert.ok(manifest.differentiators.includes("Cross-Channel Consistency Simulator"));
  assert.ok(manifest.differentiators.includes("Rule Blast Radius Preview"));
  assert.ok(manifest.differentiators.includes("Brand Drift Time Machine"));
});
