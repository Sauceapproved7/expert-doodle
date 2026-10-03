const FORMATS=Object.freeze([
  Object.freeze({format:'hero-15',label:'15s Hero',ratio:'16:9',beat:'Hook → proof → payoff → CTA'}),
  Object.freeze({format:'reel-9x16',label:'Vertical Reel',ratio:'9:16',beat:'Pattern break → transformation → proof → CTA'}),
  Object.freeze({format:'square-1x1',label:'Square Feed',ratio:'1:1',beat:'Promise → visual proof → brand lock → CTA'}),
  Object.freeze({format:'story-9x16',label:'Story',ratio:'9:16',beat:'Hook → one proof point → direct CTA'})
]);
const DIFFERENTIATORS=Object.freeze(['Proof Strip','Campaign DNA Lock']);

const clean=value=>String(value||'').trim();

export function createCampaignForgeManifest(){
  return Object.freeze({
    schema:'sauceapproved.studio.campaign-forge',
    version:1,
    product:'Hercules Campaign Forge',
    purpose:'Turn one approved source idea into a traceable multi-format campaign plan.',
    executionPolicy:'local-plan-only',
    serverUpload:false,
    paidProviderRequired:false,
    differentiators:DIFFERENTIATORS,
    formats:FORMATS
  });
}

export function buildCampaignPack(input={}){
  const source=Object.freeze({
    title:clean(input.title),audience:clean(input.audience),promise:clean(input.promise),
    proof:clean(input.proof),cta:clean(input.cta)
  });
  if(Object.values(source).some(value=>!value)) throw new Error('campaign_truth_incomplete');
  const dna=Object.freeze({audience:source.audience,promise:source.promise,cta:source.cta});
  const outputs=Object.freeze(FORMATS.map(item=>Object.freeze({...item,dna})));
  const proofStrip=Object.freeze([
    Object.freeze({check:'source-approved',evidence:source.title,status:'required'}),
    Object.freeze({check:'promise-supported',evidence:source.proof,status:'required'}),
    Object.freeze({check:'cta-matches-offer',evidence:source.cta,status:'required'})
  ]);
  return Object.freeze({
    schema:'sauceapproved.studio.campaign-forge.pack',version:1,source,outputs,proofStrip,
    publishReady:false,
    note:'Campaign Forge creates the governed campaign plan. Publishing remains a separate explicit action.'
  });
}

export function renderCampaignForge(){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Hercules Campaign Forge</title><style>
:root{font-family:Inter,system-ui,sans-serif;background:#050505;color:#f6f6f6}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 75% 0,#30200e 0,#0d0b08 35%,#040404 72%);min-height:100vh}main{width:min(1120px,100%);margin:auto;padding:clamp(18px,4vw,46px)}a{color:#aaa;text-decoration:none;font-weight:750}.hero{margin-top:24px;padding:clamp(26px,5vw,56px);border:1px solid #3a2b17;border-radius:32px;background:linear-gradient(145deg,#1c150c,#090909)}.eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#d5a95f}h1{font-size:clamp(46px,9vw,92px);line-height:.9;letter-spacing:-.055em;margin:12px 0 20px}h1 em{font-style:normal;color:#e7b86b}.lead{max-width:800px;color:#b8b8b8;font-size:clamp(17px,2vw,21px);line-height:1.6}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:18px}.card{padding:24px;border:1px solid #29231b;border-radius:24px;background:#0c0b09}.card h2{margin:8px 0}.card p{color:#999;line-height:1.55}.proof{margin-top:18px;padding:18px;border:1px solid #5d4727;border-radius:18px;background:#1c150b;color:#edca8e}.pill{display:inline-block;margin:4px 6px 0 0;padding:7px 10px;border:1px solid #4a3b26;border-radius:999px;font-size:12px;color:#d7b77d}@media(max-width:720px){.grid{grid-template-columns:1fr}.hero{border-radius:24px}}</style></head>
<body><main><a href="/">← SauceApproved Studio</a><section class="hero"><div class="eyebrow">SauceApproved Studio / Showcase module</div><h1>Campaign <em>Forge</em></h1><p class="lead">Start with one approved idea. Forge it into a 15-second hero, vertical Reel, square feed cut and Story plan without letting the promise, proof or CTA drift between formats.</p><span class="pill">Proof Strip</span><span class="pill">Campaign DNA Lock</span></section>
<section class="grid">${FORMATS.map(item=>`<article class="card"><div class="eyebrow">${item.ratio}</div><h2>${item.label}</h2><p>${item.beat}</p></article>`).join('')}</section>
<div class="proof"><b>Hercules rule:</b> the campaign plan stays local and non-publishing. Proof Strip keeps the claim tied to evidence; Campaign DNA Lock keeps audience, promise and CTA consistent across every cut.</div></main></body></html>`;
}
