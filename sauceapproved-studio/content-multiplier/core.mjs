const DEFAULT_FATIGUE_THRESHOLD=0.78;

function freezeList(values=[]){
  return Object.freeze([...new Set((Array.isArray(values)?values:[])
    .map(value=>String(value??"").trim())
    .filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,"en",{sensitivity:"base"})));
}

function freezeFacts(facts=[]){
  return Object.freeze((Array.isArray(facts)?facts:[])
    .map(fact=>Object.freeze({
      id:String(fact?.id||"").trim(),
      value:String(fact?.value??"").trim(),
      locked:fact?.locked!==false,
      sourceId:fact?.sourceId ? String(fact.sourceId) : null
    }))
    .filter(fact=>fact.id && fact.value));
}

function normalizeText(value){
  const numberWords=new Map([
    ["zero","0"],["one","1"],["two","2"],["three","3"],["four","4"],["five","5"],
    ["six","6"],["seven","7"],["eight","8"],["nine","9"],["ten","10"]
  ]);
  return String(value??"")
    .toLowerCase()
    .replace(/[’']/g,"")
    .replace(/[^a-z0-9\s]/g," ")
    .split(/\s+/)
    .filter(Boolean)
    .map(token=>numberWords.get(token)||token)
    .join(" ");
}

function tokenSet(value){
  return new Set(normalizeText(value).split(" ").filter(Boolean));
}

function jaccard(a,b){
  const left=tokenSet(a);
  const right=tokenSet(b);
  if(!left.size && !right.size)return 1;
  if(!left.size || !right.size)return 0;
  let intersection=0;
  for(const token of left)if(right.has(token))intersection++;
  const union=new Set([...left,...right]).size;
  return union ? intersection/union : 0;
}

function ensureObject(value,error){
  if(!value || typeof value!=="object" || Array.isArray(value))throw new Error(error);
  return value;
}

export function createContentDna(input={}){
  ensureObject(input,"content_dna_input_required");
  const brandId=String(input.brandId||"").trim();
  if(!brandId)throw new Error("content_dna_brand_id_required");
  return Object.freeze({
    schema:"sauceapproved.studio.content-dna",
    version:1,
    brandId,
    vocabulary:freezeList(input.vocabulary),
    bannedPhrases:freezeList(input.bannedPhrases),
    audiences:freezeList(input.audiences),
    tone:freezeList(input.tone),
    visualCues:freezeList(input.visualCues),
    preferredHooks:freezeList(input.preferredHooks),
    offers:freezeList(input.offers),
    lockedFacts:freezeFacts(input.lockedFacts)
  });
}

export function createVariationTree({projectId,rootAsset}={}){
  const id=String(projectId||"").trim();
  if(!id)throw new Error("variation_project_id_required");
  ensureObject(rootAsset,"variation_root_asset_required");
  const rootId=String(rootAsset.id||"").trim();
  if(!rootId)throw new Error("variation_root_id_required");
  const root=Object.freeze({
    id:rootId,
    parentId:null,
    dimension:"root",
    value:"root",
    label:String(rootAsset.label||"Original"),
    content:String(rootAsset.content||""),
    lineage:Object.freeze([])
  });
  return Object.freeze({
    schema:"sauceapproved.studio.variation-tree",
    version:1,
    projectId:id,
    nodes:Object.freeze([root])
  });
}

export function addVariationBranch({tree,parentId,branch}={}){
  ensureObject(tree,"variation_tree_required");
  ensureObject(branch,"variation_branch_required");
  const parent=tree.nodes?.find(node=>node.id===String(parentId||""));
  if(!parent)throw new Error("variation_parent_not_found");
  const dimension=String(branch.dimension||"").trim().toLowerCase();
  const value=String(branch.value||"").trim().toLowerCase();
  if(!dimension || !value)throw new Error("variation_branch_dimension_value_required");
  const duplicate=tree.nodes.some(node=>
    node.parentId===parent.id &&
    String(node.dimension).toLowerCase()===dimension &&
    String(node.value).toLowerCase()===value
  );
  if(duplicate)throw new Error("variation_branch_duplicate");
  const id=String(branch.id||`${parent.id}:${dimension}:${value}`);
  if(tree.nodes.some(node=>node.id===id))throw new Error("variation_node_id_duplicate");
  const node=Object.freeze({
    id,
    parentId:parent.id,
    dimension,
    value,
    label:String(branch.label||`${dimension}: ${value}`),
    content:String(branch.content||""),
    lineage:Object.freeze([...parent.lineage,parent.id])
  });
  return Object.freeze({...tree,nodes:Object.freeze([...tree.nodes,node])});
}

export function evaluateVariantFatigue({candidate,existing=[],threshold=DEFAULT_FATIGUE_THRESHOLD}={}){
  const clean=String(candidate||"").trim();
  if(!clean)throw new Error("variant_candidate_required");
  const limit=Number.isFinite(Number(threshold))?Math.min(1,Math.max(0,Number(threshold))):DEFAULT_FATIGUE_THRESHOLD;
  let best={matchedId:null,similarity:0};
  for(const item of Array.isArray(existing)?existing:[]){
    const similarity=jaccard(clean,item?.content);
    if(similarity>best.similarity)best={matchedId:String(item?.id||""),similarity};
  }
  return Object.freeze({
    fatigued:best.similarity>=limit,
    matchedId:best.similarity>=limit ? best.matchedId : null,
    similarity:Number(best.similarity.toFixed(4)),
    threshold:limit
  });
}

export function findContentOpportunities({
  sourceMoments=[],
  brandFacts=[],
  usedEvidenceIds=[]
}={}){
  const used=new Set((Array.isArray(usedEvidenceIds)?usedEvidenceIds:[]).map(String));
  const facts=(Array.isArray(brandFacts)?brandFacts:[])
    .filter(item=>item?.locked===true && item?.id && !used.has(String(item.id)))
    .map(item=>Object.freeze({
      id:String(item.id),
      type:"locked-brand-fact",
      value:String(item.value??""),
      score:1
    }));
  const moments=(Array.isArray(sourceMoments)?sourceMoments:[])
    .filter(item=>item?.id && !used.has(String(item.id)))
    .map(item=>Object.freeze({
      id:String(item.id),
      type:"source-moment",
      value:String(item.text??""),
      score:Number.isFinite(Number(item.score))?Number(item.score):0.5
    }));
  return Object.freeze([...facts,...moments].sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id)));
}

export function validateGeneratedAsset({asset,dna}={}){
  ensureObject(asset,"generated_asset_required");
  ensureObject(dna,"content_dna_required");
  if(!String(asset.id||"").trim())return Object.freeze({ok:false,error:"asset_id_required"});
  if(!String(asset.platform||"").trim())return Object.freeze({ok:false,error:"asset_platform_required"});
  const content=String(asset.content||"");
  const normalized=normalizeText(content);
  for(const phrase of dna.bannedPhrases||[]){
    if(normalized.includes(normalizeText(phrase))){
      return Object.freeze({ok:false,error:"banned_phrase_present",phrase});
    }
  }
  const bindings=asset.factBindings && typeof asset.factBindings==="object" ? asset.factBindings : {};
  for(const fact of dna.lockedFacts||[]){
    if(Object.prototype.hasOwnProperty.call(bindings,fact.id) && String(bindings[fact.id])!==fact.value){
      return Object.freeze({ok:false,error:"locked_fact_mismatch",factId:fact.id});
    }
  }
  return Object.freeze({ok:true});
}

export async function buildGenerationRequest({
  source,
  dna,
  platforms=[],
  goal,
  generator
}={}){
  if(typeof generator!=="function"){
    return Object.freeze({ok:false,error:"generation_provider_unavailable"});
  }
  ensureObject(source,"generation_source_required");
  ensureObject(dna,"content_dna_required");
  const platformList=freezeList(platforms);
  if(!platformList.length)throw new Error("generation_platform_required");
  const request=Object.freeze({
    schema:"sauceapproved.studio.content-generation-request",
    version:1,
    source:Object.freeze({
      kind:String(source.kind||"text"),
      content:String(source.content||"")
    }),
    goal:String(goal||"general"),
    platforms:platformList,
    constraints:Object.freeze({
      brandId:String(dna.brandId||""),
      vocabulary:dna.vocabulary||Object.freeze([]),
      bannedPhrases:dna.bannedPhrases||Object.freeze([]),
      audiences:dna.audiences||Object.freeze([]),
      tone:dna.tone||Object.freeze([]),
      lockedFacts:dna.lockedFacts||Object.freeze([])
    })
  });
  const generated=await generator(request);
  const assets=Array.isArray(generated?.assets)?generated.assets:[];
  const invalid=[];
  for(const asset of assets){
    const result=validateGeneratedAsset({asset,dna});
    if(!result.ok)invalid.push(Object.freeze({assetId:String(asset?.id||""),...result}));
  }
  if(invalid.length){
    return Object.freeze({ok:false,error:"generated_asset_validation_failed",invalid:Object.freeze(invalid)});
  }
  return Object.freeze({ok:true,request,assets:Object.freeze(assets.map(asset=>Object.freeze({...asset})))});
}

export function createContentMultiplierManifest(){
  return Object.freeze({
    schema:"sauceapproved.studio.content-multiplier-manifest",
    version:1,
    product:"SauceApproved Content Multiplier",
    executionPolicy:"fail-closed",
    differentiators:Object.freeze([
      "Content DNA",
      "Variation Tree",
      "Content Opportunity Radar",
      "Variant Fatigue Guard"
    ]),
    providerRequiredForGeneration:true
  });
}
