function freezeArray(values=[]){
  return Object.freeze([...(Array.isArray(values)?values:[])]);
}

function normalizeScope(value){
  const text=String(value||"global").trim().toLowerCase();
  return text || "global";
}

function normalizeKind(value){
  const text=String(value||"preference").trim().toLowerCase();
  return text==="hard" ? "hard" : "preference";
}

function normalizeRule(rule,index=0){
  const id=String(rule?.id||`rule-${index+1}`).trim();
  const key=String(rule?.key||"").trim();
  if(!id)throw new Error("brand_rule_id_required");
  if(!key)throw new Error("brand_rule_key_required");
  return Object.freeze({
    id,
    kind:normalizeKind(rule?.kind),
    scope:normalizeScope(rule?.scope),
    key,
    value:String(rule?.value??""),
    priority:Number.isFinite(Number(rule?.priority))?Number(rule.priority):0,
    active:rule?.active!==false,
    overrides:rule?.overrides ? String(rule.overrides) : null,
    inherited:rule?.inherited===true
  });
}

function ruleSpecificity(rule,channel){
  if(!channel)return rule.scope==="global" ? 1 : 0;
  const target=`channel:${String(channel).trim().toLowerCase()}`;
  if(rule.scope===target)return 3;
  if(rule.scope==="global")return 1;
  return 0;
}

function detectHardConflicts(rules){
  const active=rules.filter(rule=>rule.active && rule.kind==="hard");
  for(let i=0;i<active.length;i++){
    for(let j=i+1;j<active.length;j++){
      const a=active[i], b=active[j];
      if(a.key!==b.key)continue;
      if(a.scope!==b.scope)continue;
      if(a.priority!==b.priority)continue;
      if(a.value===b.value)continue;
      if(a.overrides===b.id || b.overrides===a.id)continue;
      throw new Error(`brand_rule_conflict:${a.id}:${b.id}`);
    }
  }
}

export function createBrandKnowledge(input={}){
  const brandId=String(input?.brandId||"").trim();
  if(!brandId)throw new Error("brand_knowledge_brand_id_required");

  const sources=Object.freeze((Array.isArray(input.sources)?input.sources:[])
    .map(source=>Object.freeze({
      id:String(source?.id||"").trim(),
      type:String(source?.type||"unknown").trim(),
      label:String(source?.label||"").trim()
    }))
    .filter(source=>source.id));

  const sourceIds=new Set(sources.map(source=>source.id));
  const facts=Object.freeze((Array.isArray(input.facts)?input.facts:[])
    .map(fact=>{
      const sourceId=String(fact?.sourceId||"").trim();
      if(sourceId && !sourceIds.has(sourceId))throw new Error(`brand_fact_source_unknown:${sourceId}`);
      return Object.freeze({
        id:String(fact?.id||"").trim(),
        value:String(fact?.value??""),
        locked:fact?.locked===true,
        sourceId:sourceId||null
      });
    })
    .filter(fact=>fact.id));

  return Object.freeze({
    schema:"sauceapproved.studio.brand-knowledge",
    version:1,
    brandId,
    sources,
    facts
  });
}

export function proposeBrandFactChange({knowledge,fact}={}){
  if(!knowledge || typeof knowledge!=="object")throw new Error("brand_knowledge_required");
  if(!fact || typeof fact!=="object")throw new Error("brand_fact_proposal_required");
  const id=String(fact.id||"").trim();
  if(!id)throw new Error("brand_fact_id_required");
  const proposedValue=String(fact.value??"");
  const existing=(knowledge.facts||[]).find(item=>item.id===id) || null;
  const conflict=Boolean(existing?.locked && existing.value!==proposedValue);
  return Object.freeze({
    status:"review-required",
    factId:id,
    conflict,
    currentValue:existing?.value ?? null,
    proposedValue,
    sourceId:fact.sourceId ? String(fact.sourceId) : null,
    locked:existing?.locked===true,
    autoApplied:false
  });
}

export function createBrandConstitution({brandId,version=1,rules=[]}={}){
  const id=String(brandId||"").trim();
  if(!id)throw new Error("brand_constitution_brand_id_required");
  const normalized=Object.freeze((Array.isArray(rules)?rules:[]).map(normalizeRule));
  detectHardConflicts(normalized);
  return Object.freeze({
    schema:"sauceapproved.studio.brand-constitution",
    version:Number.isFinite(Number(version))?Number(version):1,
    brandId:id,
    parentBrandId:null,
    rules:normalized
  });
}

export function resolveBrandRule({constitution,key,channel=null}={}){
  if(!constitution || typeof constitution!=="object")throw new Error("brand_constitution_required");
  const targetKey=String(key||"").trim();
  if(!targetKey)throw new Error("brand_rule_key_required");
  const candidates=(constitution.rules||[])
    .filter(rule=>rule.active && rule.key===targetKey)
    .map(rule=>({rule,specificity:ruleSpecificity(rule,channel)}))
    .filter(item=>item.specificity>0)
    .sort((a,b)=>{
      if(b.specificity!==a.specificity)return b.specificity-a.specificity;
      if((b.rule.kind==="hard")!==(a.rule.kind==="hard"))return b.rule.kind==="hard" ? 1 : -1;
      if(b.rule.priority!==a.rule.priority)return b.rule.priority-a.rule.priority;
      return a.rule.id.localeCompare(b.rule.id);
    });
  return candidates.length ? candidates[0].rule : null;
}

export function inheritBrandConstitution({parent,childBrandId,childRules=[]}={}){
  if(!parent || typeof parent!=="object")throw new Error("parent_brand_constitution_required");
  const id=String(childBrandId||"").trim();
  if(!id)throw new Error("child_brand_id_required");
  const inherited=(parent.rules||[]).map(rule=>normalizeRule({...rule,inherited:true}));
  const child=(Array.isArray(childRules)?childRules:[]).map(normalizeRule);
  const rules=Object.freeze([...inherited,...child]);
  detectHardConflicts(rules);
  return Object.freeze({
    schema:"sauceapproved.studio.brand-constitution",
    version:Number(parent.version||1),
    brandId:id,
    parentBrandId:String(parent.brandId||""),
    rules
  });
}

export function simulateCrossChannelConsistency({assets=[]}={}){
  const list=Array.isArray(assets)?assets:[];
  const fields=["price","cta","disclosure","promise","audience","timing"];
  const inconsistencies=[];
  for(const field of fields){
    const values=new Map();
    for(const asset of list){
      const value=String(asset?.[field]??"");
      const bucket=values.get(value)||[];
      bucket.push(String(asset?.id||asset?.channel||"asset"));
      values.set(value,bucket);
    }
    if(values.size>1){
      inconsistencies.push(Object.freeze({
        field,
        variants:Object.freeze([...values.entries()].map(([value,assetIds])=>Object.freeze({value,assetIds:Object.freeze(assetIds)}))),
        recommendation:`Review conflicting ${field} values before publishing.`
      }));
    }
  }
  return Object.freeze({
    schema:"sauceapproved.studio.cross-channel-consistency",
    version:1,
    ok:inconsistencies.length===0,
    inconsistencies:Object.freeze(inconsistencies),
    autoCorrected:false
  });
}

export function createRuleBlastRadiusPreview({proposedRule,dependencies=[]}={}){
  if(!proposedRule || typeof proposedRule!=="object")throw new Error("proposed_brand_rule_required");
  const ruleId=String(proposedRule.id||"").trim();
  const key=String(proposedRule.key||"").trim();
  if(!ruleId || !key)throw new Error("proposed_brand_rule_identity_required");
  const affected=(Array.isArray(dependencies)?dependencies:[])
    .filter(item=>{
      const ruleIds=Array.isArray(item?.ruleIds)?item.ruleIds.map(String):[];
      const keys=Array.isArray(item?.keys)?item.keys.map(String):[];
      return ruleIds.includes(ruleId) || keys.includes(key);
    })
    .map(item=>Object.freeze({
      type:String(item?.type||"unknown"),
      id:String(item?.id||""),
      reason:(Array.isArray(item?.ruleIds)&&item.ruleIds.map(String).includes(ruleId))?"direct-rule-reference":"rule-key-dependency"
    }));
  return Object.freeze({
    schema:"sauceapproved.studio.brand-rule-blast-radius",
    version:1,
    proposedRuleId:ruleId,
    affected:Object.freeze(affected),
    requiresReview:true
  });
}

function constitutionKeyValues(constitution){
  const map=new Map();
  for(const rule of constitution.rules||[]){
    if(!rule.active)continue;
    const current=map.get(rule.key);
    if(!current || rule.priority>current.priority || (rule.kind==="hard" && current.kind!=="hard")){
      map.set(rule.key,rule);
    }
  }
  return map;
}

function judgeAsset(constitution,asset){
  const attributes=asset?.attributes && typeof asset.attributes==="object" ? asset.attributes : {};
  const channel=asset?.channel || null;
  const violations=[];
  const keys=new Set((constitution.rules||[]).map(rule=>rule.key));
  for(const key of keys){
    const rule=resolveBrandRule({constitution,key,channel});
    if(!rule || rule.kind!=="hard")continue;
    if(Object.prototype.hasOwnProperty.call(attributes,key) && String(attributes[key])!==String(rule.value)){
      violations.push(Object.freeze({key,expected:String(rule.value),actual:String(attributes[key]),ruleId:rule.id}));
    }
  }
  return Object.freeze({compliant:violations.length===0,violations:Object.freeze(violations)});
}

export function compareBrandConstitutionVersions({from,to,asset}={}){
  if(!from || !to)throw new Error("brand_constitution_versions_required");
  const left=constitutionKeyValues(from);
  const right=constitutionKeyValues(to);
  const keys=new Set([...left.keys(),...right.keys()]);
  const changedKeys=[...keys].filter(key=>{
    const a=left.get(key), b=right.get(key);
    return !a || !b || a.value!==b.value || a.kind!==b.kind || a.scope!==b.scope || a.priority!==b.priority;
  }).sort();
  return Object.freeze({
    schema:"sauceapproved.studio.brand-drift-time-machine",
    version:1,
    brandId:String(to.brandId||from.brandId||""),
    fromVersion:Number(from.version||0),
    toVersion:Number(to.version||0),
    changedKeys:Object.freeze(changedKeys),
    fromJudgment:judgeAsset(from,asset),
    toJudgment:judgeAsset(to,asset)
  });
}

export function createBrandBrainManifest(){
  return Object.freeze({
    schema:"sauceapproved.studio.brand-brain-manifest",
    version:1,
    product:"SauceApproved Brand Brain",
    executionPolicy:"approval-gated",
    silentAutoLearningAllowed:false,
    differentiators:Object.freeze([
      "Brand Constitution",
      "Cross-Channel Consistency Simulator",
      "Rule Blast Radius Preview",
      "Brand Drift Time Machine"
    ])
  });
}
