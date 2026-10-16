// Hercules Marketing Command v1 — first-party, offline, read-only campaign planning.
export const DIVISIONS=Object.freeze(['apparel','forge','studio','titan','gatehouse']);
export const CHANNELS=Object.freeze(['instagram','tiktok','youtube','pinterest','seo','email','b2b_outreach','affiliate','meta_ads','google_ads']);
export const FORMATS=Object.freeze([
  Object.freeze({format:'hero-15',name:'15-second hero',ratio:'16:9',beat:'Problem → credible proof → offer → CTA'}),
  Object.freeze({format:'reel-9x16',name:'Vertical Reel',ratio:'9:16',beat:'Attention → product in use → evidence → CTA'}),
  Object.freeze({format:'square-1x1',name:'Square social',ratio:'1:1',beat:'Audience → offer → supported benefit → CTA'}),
  Object.freeze({format:'story-9x16',name:'Story',ratio:'9:16',beat:'Hook → proof → one clear next action'})
]);
const clean=(value)=>String(value??'').trim();
const money=(n)=>Math.round((n+Number.EPSILON)*100)/100;
const finiteNonnegative=(value,label)=>{
  const n=typeof value==='number'?value:Number(value);
  if(typeof value==='string'&&!value.trim())throw Error(label+'_invalid');
  if(!Number.isFinite(n)||n<0||n>1e9)throw Error(label+'_invalid');
  return n;
};
const bounded=(value,max)=>clean(value).length>0&&clean(value).length<=max;
const ownedUrl=(value)=>{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||!url.hostname)return false;
  if(url.port&&url.port!=='443')return false;
  const host=url.hostname.toLowerCase().replace(/\.$/,'');
  return host==='sauceapproved.com'||host.endsWith('.sauceapproved.com');
};

export function buildTrackedUrl(destination,{source,medium,campaign,content}={}){
  if(typeof destination!=='string'||destination.length>2000||!ownedUrl(destination))throw Error('owned_https_destination_required');
  const fields={utm_source:source,utm_medium:medium,utm_campaign:campaign,utm_content:content};
  const url=new URL(destination);
  for(const [key,value] of Object.entries(fields)){
    if(value==null||String(value).trim()==='')continue;
    const token=String(value).trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,72);
    if(!token)throw Error('utm_value_invalid');
    url.searchParams.set(key,token);
  }
  return url.toString();
}

export function calculateEconomics({price,unitCost,fees,fulfillmentCost,cac}={}){
  const p=finiteNonnegative(price,'price');
  const c=finiteNonnegative(unitCost,'unit_cost');
  const f=finiteNonnegative(fees,'fees');
  const ship=finiteNonnegative(fulfillmentCost,'fulfillment_cost');
  const acquisition=finiteNonnegative(cac,'cac');
  const margin=money(p-c-f-ship);
  const net=money(margin-acquisition);
  return Object.freeze({
    price:p,preAcquisitionContribution:margin,breakEvenCac:margin,
    netContribution:net,profitable:net>0,reportedRevenue:null,
    disclaimer:'Scenario only; excludes returns, taxes, overhead and real order verification.'
  });
}

export function reviewClaims(message){
  const s=clean(message);
  const flags=[];
  const add=(code,reason)=>flags.push(Object.freeze({code,reason}));
  if(/\b(?:nasa|spacex|darpa)\s*[- ]?\s*(?:approved|certified|partner|endorsed|official)\b/i.test(s)||
      /\b(?:official|endorsed|certified)\s+(?:by\s+)?(?:nasa|spacex|darpa)\b/i.test(s)){
    add('institution_endorsement','Third-party institutional endorsement must not be implied.');
  }
  if(/\b(?:guaranteed?\s+(?:results?|sales|income|profits?|returns?|\d+[x%])|make\s+\$\d+\s+(?:per|a)\s+day)\b/i.test(s)){
    add('outcome_guarantee','Financial/performance guarantees require substantiation and legal review.');
  }
  if(/\b(?:only\s+(?:\d+|one|two|three)\s+left|last\s+chance|ends?\s+(?:in\s+)?\d+\s+(?:minutes?|hours?))\b/i.test(s)){
    add('scarcity_claim','Real scarcity and deadline evidence must be verified.');
  }
  if(/\b(?:five[- ]star reviews?|customers? (?:all|always) love|rated 5 stars by)\b/i.test(s)){
    add('testimonial_claim','Reviews and testimonials require genuine evidence and proper disclosures.');
  }
  if(/\b(?:100%\s+free|completely free|no fees? ever)\b/i.test(s)){
    add('price_claim','Verify complete price, terms and mandatory fees.');
  }
  return Object.freeze(flags);
}

export function evaluateCampaign(input={}){
  const blockers=[];
  if(!DIVISIONS.includes(input.division))blockers.push('unsupported_division');
  if(!CHANNELS.includes(input.channel))blockers.push('unsupported_channel');
  for(const [field,max] of [['title',120],['audience',160],['promise',280],['proof',700],['cta',100]]){
    if(!bounded(input[field],max))blockers.push(field==='proof'?'proof_required':'invalid_'+field);
  }
  if(!input.destination||typeof input.destination!=='string'||input.destination.length>2000){
    blockers.push('owned_destination_required');
  }else{
    try{if(!ownedUrl(input.destination))blockers.push('owned_destination_required')}
    catch{blockers.push('owned_destination_required')}
  }
  if(['email','b2b_outreach'].includes(input.channel)&&input.recipientConsent!==true){
    blockers.push('recipient_consent_required');
  }
  const claimFlags=reviewClaims([input.title,input.promise,input.proof].map(clean).join(' '));
  if(claimFlags.length)blockers.push('claims_require_review');
  return Object.freeze({
    schema:'sauceapproved.marketing-command.review.v1',
    reviewReady:blockers.length===0,
    publicationAllowed:false,automaticSpendAllowed:false,automaticOutreachAllowed:false,
    blockers:Object.freeze([...new Set(blockers)]),claimFlags,
    evidenceIndependentlyVerified:false,
    note:'Draft/planning tool only. Content entry is not proof verification or publishing authorization.'
  });
}

export function buildContentPack(input={}){
  const review=evaluateCampaign(input);
  if(!review.reviewReady)throw Error('campaign_brief_incomplete');
  return Object.freeze(FORMATS.map(x=>Object.freeze({
    ...x,title:clean(input.title),audience:clean(input.audience),promise:clean(input.promise),
    proof:clean(input.proof),cta:clean(input.cta),destination:clean(input.destination),
    published:false,generatedAsset:false,approved:false
  })));
}

export function rankOpportunities(items=[]){
  if(!Array.isArray(items)||items.length>100)throw Error('opportunities_invalid');
  return Object.freeze(items.flatMap(item=>{
    if(!item||!bounded(item.title,160)||!bounded(item.sourceUrl,2000))return [];
    let url;
    try{url=new URL(item.sourceUrl)}catch{return []}
    if(url.protocol!=='https:'||url.username||url.password)return [];
    const relevance=Number(item.relevance),strength=Number(item.evidenceStrength),effort=Number(item.effort);
    if(![relevance,strength,effort].every(x=>Number.isInteger(x)&&x>=1&&x<=5))return [];
    return [Object.freeze({
      title:clean(item.title),sourceUrl:url.toString(),
      score:relevance*3+strength*2-effort,measuredDemand:false,
      state:'unverified-market-hypothesis'
    })];
  }).sort((a,b)=>b.score-a.score));
}
