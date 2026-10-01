const DIFFERENTIATORS=Object.freeze(['Evidence Grade','Outcome Loop']);
const OBJECTIVES=new Set(['conversion_rate','click_through_rate','cost_per_conversion']);
const n=value=>Number.isFinite(Number(value))&&Number(value)>=0?Number(value):0;

export function createPerformanceBrainManifest(){
  return Object.freeze({
    schema:'sauceapproved.studio.performance-brain',
    version:1,
    product:'Hercules Performance Brain',
    purpose:'Compare campaign outcomes only when the underlying performance evidence is explicitly verified.',
    executionPolicy:'evidence-analysis-only',
    autoPublish:false,
    autoSpend:false,
    paidProviderRequired:false,
    differentiators:DIFFERENTIATORS
  });
}

function gradeEvidence(variant){
  const required=['impressions','clicks','conversions','spend'];
  const verified=required.filter(key=>variant?.evidence?.[key]===true);
  return Object.freeze({verified,required,complete:verified.length===required.length,grade:verified.length===4?'A':verified.length>=3?'B':verified.length>=2?'C':'D'});
}

function metric(variant,objective){
  const impressions=n(variant.impressions),clicks=n(variant.clicks),conversions=n(variant.conversions),spend=n(variant.spend);
  if(objective==='click_through_rate') return impressions>0?clicks/impressions:0;
  if(objective==='cost_per_conversion') return conversions>0?spend/conversions:Number.POSITIVE_INFINITY;
  return clicks>0?conversions/clicks:0;
}

export function evaluateCampaignPerformance(input={}){
  const objective=OBJECTIVES.has(input.objective)?input.objective:'conversion_rate';
  const variants=Array.isArray(input.variants)?input.variants:[];
  const scored=variants.map(item=>{
    const evidence=gradeEvidence(item);
    return Object.freeze({id:String(item?.id||''),evidence,value:metric(item,objective)});
  });
  const complete=scored.length>=2&&scored.every(item=>item.id&&item.evidence.complete);
  if(!complete){
    return Object.freeze({
      schema:'sauceapproved.studio.performance-brain.result',version:1,status:'insufficient_verified_evidence',
      basis:objective,winner:null,variants:Object.freeze(scored),publishReady:false,
      outcomeLoop:Object.freeze({nextAction:'collect_verified_evidence',automaticMutation:false})
    });
  }
  const ordered=[...scored].sort((a,b)=>objective==='cost_per_conversion'?a.value-b.value:b.value-a.value);
  const winner=Number.isFinite(ordered[0].value)?ordered[0].id:null;
  return Object.freeze({
    schema:'sauceapproved.studio.performance-brain.result',version:1,
    status:winner?'verified_comparison':'insufficient_verified_evidence',basis:objective,winner,
    variants:Object.freeze(scored),publishReady:false,
    outcomeLoop:Object.freeze({nextAction:winner?'review_recommendation':'collect_verified_evidence',automaticMutation:false})
  });
}
