const SENSITIVE_MEMORY_KEYS=new Set([
  "race","ethnicity","religion","health","healthCondition","disability",
  "sexualOrientation","sexLife","politicalPreference","politicalAffiliation",
  "tradeUnion","criminalHistory","biometricData"
]);

function freezeArray(values=[]){
  return Object.freeze([...new Set((Array.isArray(values)?values:[])
    .map(value=>String(value??"").trim())
    .filter(Boolean))]);
}

function freezeRecord(record={}){
  return Object.freeze({...record});
}

function normalize(value){
  return String(value??"")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g," ")
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeCategory(value){
  const clean=String(value||"other").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-");
  return clean || "other";
}

function parseBudgetMaxCents(value){
  const text=String(value||"").toLowerCase();
  const numbers=text.match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  if(!numbers.length)return null;
  const amount=/under|below|max|up to|less than/.test(text) ? numbers[0] : Math.max(...numbers);
  return Math.round(amount*100);
}

export function createApprovedSalesKnowledge(input={}){
  const brandId=String(input?.brandId||"").trim();
  if(!brandId)throw new Error("sales_knowledge_brand_id_required");

  const products=Object.freeze((Array.isArray(input.products)?input.products:[])
    .map(item=>Object.freeze({
      id:String(item?.id||"").trim(),
      name:String(item?.name||"").trim(),
      priceCents:Number.isFinite(Number(item?.priceCents))?Math.round(Number(item.priceCents)):null,
      tags:freezeArray(item?.tags),
      active:item?.active===true
    }))
    .filter(item=>item.id && item.name));

  const facts=Object.freeze((Array.isArray(input.facts)?input.facts:[])
    .map(item=>Object.freeze({
      id:String(item?.id||"").trim(),
      value:String(item?.value??"").trim(),
      locked:item?.locked!==false
    }))
    .filter(item=>item.id && item.value));

  const faqs=Object.freeze((Array.isArray(input.faqs)?input.faqs:[])
    .map(item=>Object.freeze({
      id:String(item?.id||"").trim(),
      question:String(item?.question||"").trim(),
      answer:String(item?.answer||"").trim()
    }))
    .filter(item=>item.id && item.question && item.answer));

  return Object.freeze({
    schema:"sauceapproved.studio.sales-approved-knowledge",
    version:1,
    brandId,
    products,
    facts,
    faqs
  });
}

export function createAdaptivePitchMemory({sessionId}={}){
  const id=String(sessionId||"").trim();
  if(!id)throw new Error("sales_session_id_required");
  return Object.freeze({
    schema:"sauceapproved.studio.adaptive-pitch-memory",
    version:1,
    sessionId:id,
    budgetRange:null,
    desiredOutcome:null,
    priorities:Object.freeze([]),
    statedPreferences:Object.freeze([]),
    objections:Object.freeze([])
  });
}

export function updateAdaptivePitchMemory({memory,explicit={}}={}){
  if(!memory || typeof memory!=="object")throw new Error("sales_memory_required");
  const clean={};
  for(const [key,value] of Object.entries(explicit||{})){
    if(SENSITIVE_MEMORY_KEYS.has(key))continue;
    clean[key]=value;
  }
  return Object.freeze({
    schema:"sauceapproved.studio.adaptive-pitch-memory",
    version:1,
    sessionId:String(memory.sessionId||""),
    budgetRange:clean.budgetRange!==undefined ? String(clean.budgetRange||"").trim()||null : memory.budgetRange,
    desiredOutcome:clean.desiredOutcome!==undefined ? String(clean.desiredOutcome||"").trim()||null : memory.desiredOutcome,
    priorities:clean.priorities!==undefined ? freezeArray(clean.priorities) : freezeArray(memory.priorities),
    statedPreferences:clean.statedPreferences!==undefined ? freezeArray(clean.statedPreferences) : freezeArray(memory.statedPreferences),
    objections:clean.objections!==undefined ? freezeArray(clean.objections) : freezeArray(memory.objections)
  });
}

function productScore(product,memory){
  const productTokens=new Set(normalize([product.name,...product.tags].join(" ")));
  const intentTokens=normalize([
    memory.desiredOutcome||"",
    ...(memory.statedPreferences||[]),
    ...(memory.priorities||[])
  ].join(" "));
  let matches=0;
  for(const token of intentTokens)if(productTokens.has(token))matches++;
  const desiredTokens=normalize(memory.desiredOutcome||"");
  const desiredMatches=desiredTokens.filter(token=>productTokens.has(token)).length;
  const budgetMax=parseBudgetMaxCents(memory.budgetRange);
  if(budgetMax!==null && Number.isFinite(product.priceCents) && product.priceCents>budgetMax)return -1;
  if(desiredTokens.length && desiredMatches===0)return -1;
  return matches;
}

export function recommendFromApprovedKnowledge({knowledge,memory}={}){
  if(!knowledge || typeof knowledge!=="object")throw new Error("approved_sales_knowledge_required");
  if(!memory || typeof memory!=="object")throw new Error("adaptive_pitch_memory_required");
  const scored=(knowledge.products||[])
    .filter(product=>product.active===true)
    .map(product=>({product,score:productScore(product,memory)}))
    .filter(item=>item.score>=0)
    .sort((a,b)=>b.score-a.score || a.product.name.localeCompare(b.product.name));

  if(!scored.length){
    return Object.freeze({ok:false,error:"approved_knowledge_insufficient",handoffRecommended:true});
  }

  return Object.freeze({
    ok:true,
    source:"approved-knowledge",
    recommendations:Object.freeze(scored.slice(0,3).map(({product,score})=>Object.freeze({
      productId:product.id,
      name:product.name,
      priceCents:product.priceCents,
      score
    })))
  });
}

export function recordObjection({sessionId,text,category="other",source="explicit-customer"}={}){
  const id=String(sessionId||"").trim();
  const message=String(text||"").trim();
  if(!id)throw new Error("objection_session_id_required");
  if(!message)throw new Error("objection_text_required");
  return Object.freeze({
    schema:"sauceapproved.studio.sales-objection-event",
    version:1,
    sessionId:id,
    text:message,
    category:normalizeCategory(category),
    source:String(source||"explicit-customer")
  });
}

export function buildObjectionIntelligenceMap({events=[]}={}){
  const buckets=new Map();
  for(const event of Array.isArray(events)?events:[]){
    if(!event?.category)continue;
    const category=normalizeCategory(event.category);
    const list=buckets.get(category)||[];
    list.push(event);
    buckets.set(category,list);
  }
  const clusters=[...buckets.entries()]
    .map(([category,list])=>Object.freeze({
      category,
      count:list.length,
      examples:Object.freeze(list.slice(0,3).map(item=>String(item.text||""))),
      source:"explicit-customer-objections"
    }))
    .sort((a,b)=>b.count-a.count || a.category.localeCompare(b.category));
  return Object.freeze({
    schema:"sauceapproved.studio.objection-intelligence-map",
    version:1,
    totalEvents:(Array.isArray(events)?events:[]).length,
    clusters:Object.freeze(clusters)
  });
}

export function evaluateHandoffDecision({
  knowledgeSupport=0,
  factLockCoverage=0,
  ambiguity=1,
  actionRisk="high"
}={}){
  const support=Math.max(0,Math.min(1,Number(knowledgeSupport)||0));
  const coverage=Math.max(0,Math.min(1,Number(factLockCoverage)||0));
  const unclear=Math.max(0,Math.min(1,Number(ambiguity)||0));
  const risk=String(actionRisk||"high").toLowerCase();

  if(risk==="high"){
    return Object.freeze({decision:"handoff",reason:"high_action_risk_requires_handoff"});
  }
  if(support<0.7 || coverage<0.7){
    return Object.freeze({decision:"handoff",reason:"knowledge_support_or_fact_coverage_too_low"});
  }
  if(unclear>0.5){
    return Object.freeze({decision:"clarify",reason:"conversation_ambiguity_requires_clarification"});
  }
  return Object.freeze({decision:"answer",reason:"approved_knowledge_support_sufficient"});
}

export function captureLead({consent=false,lead={}}={}){
  if(consent!==true)return Object.freeze({ok:false,error:"lead_consent_required"});
  const email=String(lead?.email||"").trim();
  const name=String(lead?.name||"").trim();
  if(!email && !name)return Object.freeze({ok:false,error:"lead_identity_required"});
  return Object.freeze({
    ok:true,
    lead:Object.freeze({
      ...(name?{name}:{}),
      ...(email?{email}:{}),
      consent:true
    })
  });
}

export function buildObjectionContentBrief({cluster,brandId}={}){
  if(!cluster || typeof cluster!=="object")throw new Error("objection_cluster_required");
  const id=String(brandId||"").trim();
  if(!id)throw new Error("objection_brief_brand_id_required");
  const category=normalizeCategory(cluster.category);
  return Object.freeze({
    schema:"sauceapproved.studio.objection-content-brief",
    version:1,
    status:"review-required",
    brandId:id,
    objectionCategory:category,
    evidenceCount:Number(cluster.count||0),
    examples:Object.freeze([...(cluster.examples||[])]),
    goal:`Create approved content that addresses the ${category} objection using locked brand facts only.`
  });
}

export async function executeApprovedAction({
  action,
  allowedActions=[],
  payload={},
  adapter
}={}){
  const name=String(action||"").trim();
  if(!freezeArray(allowedActions).includes(name)){
    return Object.freeze({ok:false,error:"sales_action_not_allowed"});
  }
  if(typeof adapter!=="function"){
    return Object.freeze({ok:false,error:"sales_action_adapter_unavailable"});
  }
  const result=await adapter(Object.freeze({action:name,payload:freezeRecord(payload)}));
  return Object.freeze({ok:true,result});
}

export function createSalesAgentManifest(){
  return Object.freeze({
    schema:"sauceapproved.studio.ai-sales-agent-manifest",
    version:1,
    product:"SauceApproved AI Sales Agent",
    executionPolicy:"fail-closed",
    actionAdapterRequired:true,
    sensitiveProfilingAllowed:false,
    differentiators:Object.freeze([
      "Objection Intelligence Map",
      "Adaptive Pitch Memory",
      "Confidence-to-Handoff Governor",
      "Objection-to-Asset Bridge"
    ])
  });
}
