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


export function buildCampaignPerformanceInput(pack={},input={}){
  if(pack?.schema!=='sauceapproved.studio.campaign-forge.pack') throw new Error('campaign_forge_pack_required');
  const metrics=input.metrics&&typeof input.metrics==='object'?input.metrics:{};
  const variants=(Array.isArray(pack.outputs)?pack.outputs:[]).map(output=>{
    const observed=metrics[output.format]&&typeof metrics[output.format]==='object'?metrics[output.format]:{};
    return Object.freeze({
      id:String(output.format||''),
      impressions:n(observed.impressions),clicks:n(observed.clicks),conversions:n(observed.conversions),spend:n(observed.spend),
      evidence:Object.freeze({
        impressions:observed.evidence?.impressions===true,
        clicks:observed.evidence?.clicks===true,
        conversions:observed.evidence?.conversions===true,
        spend:observed.evidence?.spend===true
      })
    });
  });
  return Object.freeze({
    objective:OBJECTIVES.has(input.objective)?input.objective:'conversion_rate',
    campaignDna:Object.freeze({...((pack.outputs?.[0]?.dna)||{})}),
    variants:Object.freeze(variants)
  });
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


export function renderPerformanceBrain(){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hercules Performance Brain</title><style>:root{font-family:Inter,system-ui,sans-serif;background:#060708;color:#f5f7f8}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 15% 0,#24313a,#0a0d0f 42%,#050607 78%)}main{width:min(1160px,100%);margin:auto;padding:clamp(20px,5vw,58px)}a{color:#a9d7ea;text-decoration:none}.hero{padding:clamp(30px,6vw,70px);border:1px solid #30434d;border-radius:34px;background:linear-gradient(150deg,#162229,#080a0c 72%)}.eyebrow{font-size:11px;letter-spacing:.22em;color:#8bc7df}.hero h1{font-size:clamp(54px,10vw,108px);line-height:.84;letter-spacing:-.065em;margin:14px 0 22px}.hero p{max-width:800px;color:#b8c4c9;font-size:clamp(17px,2vw,21px);line-height:1.6}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}.card{padding:28px;min-height:260px;border:1px solid #2b3c44;border-radius:25px;background:#0b1013}.card span{font-size:11px;letter-spacing:.17em;color:#7dbbd4}.card h2{font-size:31px;margin:48px 0 12px}.card p{color:#9fadb3;line-height:1.6}.guard{margin-top:16px;padding:20px;border:1px solid #5a4728;border-radius:18px;background:#18130c;color:#e7c58a;font-weight:750}.guard b{display:block;margin-bottom:6px;color:#fff}.guard code{color:#f1d7a8}@media(max-width:760px){.grid{grid-template-columns:1fr}.hero{border-radius:24px}}</style></head><body><main><a href="/">Back to SauceApproved Studio</a><section class="hero"><div class="eyebrow">SAUCEAPPROVED / VERIFIED PERFORMANCE INTELLIGENCE</div><h1>Performance<br>Brain</h1><p>Compare campaign outcomes only when the evidence is verified. The Brain grades proof quality, identifies what the verified numbers support, and sends the recommendation back for human review.</p></section><section class="grid"><article class="card"><span>01 / PROOF</span><h2>Evidence Grade</h2><p>Scores whether impressions, clicks, conversions, and spend are actually verified before a comparison can produce a winner.</p></article><article class="card"><span>02 / LEARNING</span><h2>Outcome Loop</h2><p>Turns verified campaign results into a reviewable next action without silently changing creative, budgets, publishing, or providers.</p></article></section><div class="guard"><b>Evidence-analysis only.</b>No auto-publish. No auto-spend. Recommendations require review; automatic mutation remains disabled.</div></main></body></html>`;
}
