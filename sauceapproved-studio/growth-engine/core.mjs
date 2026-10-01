const CAPABILITIES=Object.freeze([
  ['creative-factory','Creative Factory'],['content-engine','Content Engine'],
  ['organic-traffic','Organic Traffic Engine'],['lead-capture','Lead Capture System'],
  ['campaign-brain','Campaign Brain'],['experiment-engine','Experiment Engine'],
  ['customer-intelligence','Customer Intelligence'],['command-center','Marketing Command Center']
].map(([id,name])=>Object.freeze({id,name})));

const EVENT_TYPES=new Set(['impression','click','lead','checkout','purchase','refund']);
const clean=v=>String(v??'').trim();
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const freeze=x=>Object.freeze(x);
const slug=v=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64);

function requireObject(value,code){if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code);return value;}
function requireText(value,code){const out=clean(value);if(!out)throw new Error(code);return out;}
function campaignId(input){
  const seed=[input.brandId,input.offer?.id,input.source?.title].map(slug).filter(Boolean).join('-');
  return (seed||'growth')+'-v1';
}

export function createGrowthEngineManifest(){
  return freeze({
    schema:'sauceapproved.hercules.growth-engine',version:1,product:'Hercules Growth Engine',
    executionPolicy:'fail-closed',primarySignal:'revenue',capabilities:CAPABILITIES,
    differentiators:freeze([
      'Evidence Chain: every public-facing growth action stays tied to approved proof and attribution.',
      'Revenue Memory Loop: funnel and experiment signals feed future planning without auto-publishing.'
    ]),
    reuses:freeze(['SauceApproved Content Multiplier','Hercules Campaign Forge','Hercules Ad Studio','Creation Floor']),
    autoPublish:false
  });
}

export function buildGrowthPlan(input={}){
  requireObject(input,'growth_plan_input_required');
  const brandId=requireText(input.brandId,'growth_brand_id_required');
  const offer=requireObject(input.offer,'growth_offer_required');
  const source=requireObject(input.source,'growth_source_required');
  for(const key of ['id','name','url'])requireText(offer[key],`growth_offer_${key}_required`);
  for(const key of ['title','promise','proof','cta'])requireText(source[key],`growth_source_${key}_required`);
  let parsed;try{parsed=new URL(offer.url);}catch{throw new Error('growth_offer_url_invalid');}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw new Error('growth_offer_url_invalid');
  const audiences=freeze([...(input.audiences||[])].map(clean).filter(Boolean));
  const channels=freeze([...(input.channels||[])].map(clean).filter(Boolean));
  if(!audiences.length)throw new Error('growth_audience_required');
  if(!channels.length)throw new Error('growth_channel_required');
  const id=campaignId(input);
  const actions=freeze(CAPABILITIES.map((cap,index)=>freeze({
    id:`${id}:${index+1}`,capability:cap.id,status:'planned',evidenceRequired:true,
    publishAllowed:false
  })));
  const experiments=freeze([
    freeze({id:`${id}:hook`,dimension:'hook',control:'proof-first',variant:'outcome-first',primaryMetric:'purchase-rate'}),
    freeze({id:`${id}:cta`,dimension:'cta',control:source.cta,variant:`${source.cta} — see proof`,primaryMetric:'checkout-rate'})
  ]);
  return freeze({
    schema:'sauceapproved.hercules.growth-plan',version:1,brandId,
    offer:freeze({id:clean(offer.id),name:clean(offer.name),url:parsed.toString()}),
    source:freeze({title:clean(source.title),promise:clean(source.promise),proof:clean(source.proof),cta:clean(source.cta)}),
    audiences,channels,actions,experiments,publishReady:false,
    campaign:freeze({id,tracking:freeze({campaignId:id,required:freeze(['campaignId','creativeId','channel'])})}),
    loop:freeze(['research','create','publish-with-authorization','measure','learn','improve'])
  });
}

export function recordGrowthEvent(input={}){
  requireObject(input,'growth_event_input_required');
  const type=clean(input.type).toLowerCase();
  if(!EVENT_TYPES.has(type))throw new Error('growth_event_type_invalid');
  const raw=input.value==null?0:Number(input.value);
  if(!Number.isFinite(raw)||raw<0)throw new Error('growth_event_value_invalid');
  return freeze({
    schema:'sauceapproved.hercules.growth-event',version:1,type,
    campaignId:clean(input.campaignId)||null,creativeId:clean(input.creativeId)||null,
    channel:clean(input.channel)||null,value:raw,currency:clean(input.currency)||'USD',
    evidenceId:clean(input.evidenceId)||null
  });
}

export function rankOrganicOpportunities(items=[]){
  if(!Array.isArray(items))throw new Error('organic_opportunities_array_required');
  return freeze(items.map(item=>{
    requireObject(item,'organic_opportunity_invalid');
    const intent=clamp(item.intent),relevance=clamp(item.relevance),evidence=clamp(item.evidence);
    const volume=Math.max(0,Number(item.volume)||0);
    const volumeSignal=Math.min(1,Math.log10(volume+1)/6);
    const score=.4*intent+.35*relevance+.2*evidence+.05*volumeSignal;
    return freeze({...item,id:requireText(item.id,'organic_opportunity_id_required'),score:Number(score.toFixed(4))});
  }).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)));
}

export function chooseExperimentWinner({control,variant,minimumVisitors=200,minimumLift=.1}={}){
  requireObject(control,'experiment_control_required');requireObject(variant,'experiment_variant_required');
  const normalize=arm=>{
    const visitors=Number(arm.visitors),conversions=Number(arm.conversions);
    if(!Number.isInteger(visitors)||visitors<0||!Number.isInteger(conversions)||conversions<0||conversions>visitors)throw new Error('experiment_counts_invalid');
    return {id:requireText(arm.id,'experiment_arm_id_required'),visitors,conversions,rate:visitors?conversions/visitors:0};
  };
  const a=normalize(control),b=normalize(variant);
  const min=Math.max(1,Number(minimumVisitors)||1),lift=Math.max(0,Number(minimumLift)||0);
  if(a.visitors<min||b.visitors<min)return freeze({status:'collecting',winnerId:null,control:a,variant:b});
  const baseline=a.rate;
  const relative=baseline?((b.rate-baseline)/baseline):(b.rate>0?Infinity:0);
  if(relative>=lift)return freeze({status:'winner',winnerId:b.id,lift:relative,control:a,variant:b});
  if(relative<=-lift)return freeze({status:'winner',winnerId:a.id,lift:Math.abs(relative),control:a,variant:b});
  return freeze({status:'inconclusive',winnerId:null,lift:relative,control:a,variant:b});
}

export function buildCommandCenter({events=[]}={}){
  if(!Array.isArray(events))throw new Error('growth_events_array_required');
  const funnel={impressions:0,clicks:0,leads:0,checkouts:0,purchases:0,refunds:0};
  let gross=0,refunds=0;
  const byChannel={};
  for(const raw of events){
    const e=raw?.schema==='sauceapproved.hercules.growth-event'?raw:recordGrowthEvent(raw);
    const key=e.type==='lead'?'leads':e.type==='checkout'?'checkouts':e.type==='purchase'?'purchases':e.type==='refund'?'refunds':e.type+'s';
    if(Object.hasOwn(funnel,key))funnel[key]++;
    if(e.type==='purchase')gross+=e.value;
    if(e.type==='refund')refunds+=e.value;
    const ch=e.channel||'unknown';byChannel[ch]??={events:0,purchases:0,revenue:0};byChannel[ch].events++;
    if(e.type==='purchase'){byChannel[ch].purchases++;byChannel[ch].revenue+=e.value;}
    if(e.type==='refund')byChannel[ch].revenue-=e.value;
  }
  return freeze({
    schema:'sauceapproved.hercules.growth-command-center',version:1,primarySignal:'revenue',
    funnel:freeze(funnel),revenue:freeze({gross,refunds,total:gross-refunds}),
    channels:freeze(Object.fromEntries(Object.entries(byChannel).map(([k,v])=>[k,freeze(v)]))),
    optimizationRule:'Prefer verified revenue and customer progression over vanity engagement.'
  });
}
