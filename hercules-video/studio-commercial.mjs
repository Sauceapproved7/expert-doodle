import {readFileSync} from "node:fs";


function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");}
const wrap=(title,body)=>'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>'+esc(title)+'</title><style>:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#050505;color:#f6f6f6}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 20% 0,#282020 0,#0b0b0b 38%,#040404 76%)}main{width:min(1180px,100%);margin:auto;padding:clamp(18px,4vw,46px)}a{color:#e0b5aa;text-decoration:none}.hero,.doc{margin-top:22px;padding:clamp(24px,5vw,52px);border:1px solid #332a28;border-radius:28px;background:linear-gradient(145deg,#181312,#0b0b0b)}.eyebrow{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#c9978c}h1{font-size:clamp(42px,8vw,82px);line-height:.94;letter-spacing:-.05em;margin:12px 0 18px}.lead,.doc p{color:#aaa;line-height:1.65}.notice{margin-top:20px;padding:15px 17px;border:1px solid #5a4325;border-radius:15px;background:#1d150d;color:#efcb8d}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px}.plan{display:flex;flex-direction:column;gap:14px;padding:24px;border:1px solid #292525;border-radius:22px;background:#0d0d0dee}.plan.featured{border-color:#a56e61}.count{font-size:11px;letter-spacing:.18em;color:#8d7069}.plan h2{font-size:28px;margin:20px 0 0}.price{font-size:44px;font-weight:900}.price small{font-size:13px;color:#888;margin-left:5px}.plan p{color:#aaa}.plan ul{padding-left:20px;color:#bbb;line-height:1.8;flex:1}.cta{display:block;text-align:center;padding:13px;border-radius:13px;background:#f3f3f3;color:#070707;font-weight:850}.foot{margin-top:18px;color:#777;font-size:13px;line-height:1.55}.doc{max-width:900px;margin:22px auto 0}.doc h2{margin:28px 0 8px}.meta{color:#777!important}@media(max-width:820px){.grid{grid-template-columns:1fr}.hero,.doc{border-radius:22px}}</style></head><body><main><a href="/">← SauceApproved Studio</a>'+body+'</main></body></html>';

export const STUDIO_COMMERCIAL_PLANS=Object.freeze([
  Object.freeze({code:"starter",name:"Starter",monthlyUsd:29,tag:"For solo creators and small businesses.",features:Object.freeze(["Studio workspace access","Project brief + storyboard workflow","Quality and evidence views","Vintage Camera + Kids Studio"])}),
  Object.freeze({code:"pro",name:"Pro",monthlyUsd:79,tag:"For growing brands producing more creative.",features:Object.freeze(["Everything in Starter","Content Multiplier","Brand Brain","AI Sales Agent surface","Expanded production workflow"])}),
  Object.freeze({code:"agency",name:"Business",monthlyUsd:199,tag:"For teams and higher-volume creative operations.",features:Object.freeze(["Everything in Pro","Business-ready workflow lane","Higher-volume creative operations","Priority commercial onboarding","Cross-product Ads Engine path"])})
]);

export function createStudioCommercialManifest(){
  return {
    schema:"sauceapproved.studio.commercial-manifest",
    version:1,
    product:"SauceApproved Studio",
    release:"founding-customer",
    currency:"USD",
    billingCadence:"monthly",
    plans:STUDIO_COMMERCIAL_PLANS.map(plan=>({
      code:plan.code,
      name:plan.name,
      monthlyUsd:plan.monthlyUsd,
      features:[...plan.features]
    })),
    ownerApproval:{
      pricing:false,
      terms:false,
      privacy:false,
      issue:"DA-39",
      termsDocument:"docs/legal/SAUCEAPPROVED-SOFTWARE-TERMS-CANDIDATE-V1.md",
      privacyDocument:"docs/legal/SAUCEAPPROVED-SOFTWARE-PRIVACY-CANDIDATE-V1.md"
    },
    paymentPathVerified:false,
    paidCheckoutEnabled:false,
    checkoutPolicy:"fail-closed",
    checkoutLockedReason:"studio_commercial_approval_and_payment_path_required",
    foundingAccessPath:"/market"
  };
}


export function renderStudioPricingShell(){
  const cards=STUDIO_COMMERCIAL_PLANS.map((p,i)=>'<article class="plan '+(i===1?'featured':'')+'"><span class="count">0'+(i+1)+'</span><h2>'+esc(p.name)+'</h2><div class="price">$' + esc(p.monthlyUsd) + '<small>/month</small></div><p>'+esc(p.tag)+'</p><ul>'+p.features.map(f=>'<li>'+esc(f)+'</li>').join('')+'</ul><a class="cta" href="/market">Request founding access</a></article>').join('');
  return wrap("SauceApproved Studio Pricing",'<section class="hero"><div class="eyebrow">Founding Customer Release</div><h1>Studio plans built to grow with the work.</h1><p class="lead">Choose the Studio level that matches your creative workflow. Paid checkout remains intentionally locked until SauceApproved verifies its business payout, billing identity, checkout and refund path.</p><div class="notice">Pricing is public for evaluation. No charge is created from this page. Founding-access requests remain controlled until paid launch verification is complete.</div></section><section class="grid">'+cards+'</section><p class="foot"><a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="https://sauceapproved-ads-engine.floot.app/products">SauceApproved Ads Engine</a></p>');
}

const LEGAL_DOCUMENTS=Object.freeze({
  terms:new URL("../docs/legal/SAUCEAPPROVED-SOFTWARE-TERMS-CANDIDATE-V1.md",import.meta.url),
  privacy:new URL("../docs/legal/SAUCEAPPROVED-SOFTWARE-PRIVACY-CANDIDATE-V1.md",import.meta.url)
});

function renderLegalMarkdown(markdown){
  const inline=value=>esc(value).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
  const lines=String(markdown||"").split(/\r?\n/);
  const out=[];
  let listOpen=false;
  const closeList=()=>{if(listOpen){out.push("</ul>");listOpen=false;}};

  for(const raw of lines){
    const line=raw.trim();
    if(!line){closeList();continue;}
    if(line==="---"){closeList();out.push("<hr>");continue;}
    if(line.startsWith("### ")){closeList();out.push("<h3>"+inline(line.slice(4))+"</h3>");continue;}
    if(line.startsWith("## ")){closeList();out.push("<h2>"+inline(line.slice(3))+"</h2>");continue;}
    if(line.startsWith("# ")){closeList();out.push("<h1>"+inline(line.slice(2))+"</h1>");continue;}
    if(line.startsWith("- ")){
      if(!listOpen){out.push("<ul>");listOpen=true;}
      out.push("<li>"+inline(line.slice(2))+"</li>");
      continue;
    }
    closeList();
    out.push("<p>"+inline(line)+"</p>");
  }
  closeList();
  return out.join("");
}

export function renderStudioLegalShell(kind){
  const privacy=kind==="privacy";
  const title=privacy?"Privacy Policy":"Terms of Service";
  const source=readFileSync(privacy?LEGAL_DOCUMENTS.privacy:LEGAL_DOCUMENTS.terms,"utf8");
  const body='<article class="doc"><div class="eyebrow">CANONICAL COMMERCIAL CANDIDATE / OWNER REVIEW</div><div class="notice"><b>Owner approval pending.</b> Paid checkout remains locked. This page is rendered directly from the same version-controlled legal candidate referenced by the Hercules commercial approval gate.</div>'+renderLegalMarkdown(source)+'<p class="foot"><a href="/pricing">Pricing</a> · <a href="'+(privacy?'/terms':'/privacy')+'">'+(privacy?'Terms':'Privacy')+'</a></p></article>';
  return wrap("SauceApproved Studio "+title,body);
}

export function createStudioOnboardingManifest(){
  const commercial=createStudioCommercialManifest();
  return {
    schema:"sauceapproved.studio.onboarding-manifest",
    version:1,
    product:"SauceApproved Studio",
    release:"founding-customer",
    publicRoutes:[
      "/",
      "/operator",
      "/pricing",
      "/market",
      "/getting-started",
      "/support",
      "/terms",
      "/privacy",
      "/vintage-camera",
      "/kids"
    ],
    firstRun:[
      {step:1,id:"choose-workflow",label:"Choose a Studio workflow",path:"/"},
      {step:2,id:"build-brief",label:"Create or review the creative brief",path:"/"},
      {step:3,id:"review-shot-plan",label:"Review storyboard, shot plan, routing and evidence",path:"/"},
      {step:4,id:"connect-approved-provider",label:"Connect only an authorized execution provider when required",path:"/"},
      {step:5,id:"approve-output",label:"Review evidence before export or publication",path:"/"}
    ],
    trustRules:[
      "No provider is represented as connected unless Hercules verifies it.",
      "Mutation and execution stay fail-closed without trusted authorization.",
      "AI and rendered outputs require human review before commercial publication.",
      "Paid checkout stays disabled until owner approvals and the payment path are verified."
    ],
    commercial:{
      plans:commercial.plans,
      paidCheckoutEnabled:commercial.paidCheckoutEnabled,
      checkoutPolicy:commercial.checkoutPolicy,
      checkoutLockedReason:commercial.checkoutLockedReason,
      foundingAccessPath:commercial.foundingAccessPath
    }
  };
}

export function renderStudioGettingStartedShell(){
  const manifest=createStudioOnboardingManifest();
  const steps=manifest.firstRun.map(step=>
    '<article class="plan"><span class="count">0'+esc(step.step)+'</span><h2>'+esc(step.label)+'</h2><p>'+esc(
      step.id==="choose-workflow" ? "Start with the workflow that matches the job: video production, Content Multiplier, Brand Brain, AI Sales Agent, Vintage Camera, or Kids Studio." :
      step.id==="build-brief" ? "Lock the objective, audience, offer, format, constraints and approved brand facts before asking Hercules to produce." :
      step.id==="review-shot-plan" ? "Hercules keeps shot requirements, provider routing, quality evidence, recovery and provenance visible instead of hiding the work behind one button." :
      step.id==="connect-approved-provider" ? "Provider-dependent actions remain unavailable until an authorized rendering or action adapter is connected." :
      "Review the output, quality evidence and commercial claims before export, publication or customer delivery."
    )+'</p></article>'
  ).join("");
  const rules=manifest.trustRules.map(rule=>'<li>'+esc(rule)+'</li>').join("");
  return wrap("SauceApproved Studio — Getting Started",
    '<section class="hero"><div class="eyebrow">FOUNDING CUSTOMER ONBOARDING</div><h1>Start strong. Keep the evidence.</h1><p class="lead">SauceApproved Studio is built around a visible production chain: brief → plan → shots → provider routing → quality checks → assembly → evidence. The first-run path below keeps that workflow clear without pretending unavailable providers or billing are ready.</p></section>'+
    '<section class="grid">'+steps+'</section>'+
    '<article class="doc"><h2>Hercules trust rules</h2><ul>'+rules+'</ul><div class="notice">Paid checkout is still locked. You can review the product and founding-access path now; no subscription charge can be created until the commercial and payment gates are cleared.</div><p class="foot"><a href="/market">Founding access</a> · <a href="/pricing">Pricing</a> · <a href="/support">Support</a> · <a href="/">Open Studio</a></p></article>');
}

export function renderStudioSupportShell(){
  const commercial=createStudioCommercialManifest();
  const rows=[
    ["Studio access","Use the Studio root and public modules to review the product. Paid subscriber access is not enabled until checkout verification passes."],
    ["Provider connection","If a render or action provider is unavailable, Hercules keeps the affected action locked rather than fabricating a result."],
    ["Run recovery","Verified run identity, recovery state and evidence are preserved by the Hercules Video contract. Resume remains gated by integrity and authorization."],
    ["Billing","The current pricing is public for review, but checkout stays fail-closed until owner approval, Stripe readiness, and the controlled payment/refund verification are complete."],
    ["Terms and Privacy","The public Terms and Privacy pages are rendered from the canonical version-controlled candidates used by the Hercules approval gate."],
    ["Ads Engine","For paid-ad planning and campaign governance, use the separate SauceApproved Ads Engine product surface."]
  ];
  const cards=rows.map((row,i)=>'<article class="plan"><span class="count">0'+(i+1)+'</span><h2>'+esc(row[0])+'</h2><p>'+esc(row[1])+'</p></article>').join("");
  return wrap("SauceApproved Studio — Support",
    '<section class="hero"><div class="eyebrow">SAUCEAPPROVED STUDIO / SUPPORT</div><h1>Know what is live, locked, and verified.</h1><p class="lead">This support surface separates real Studio capabilities from anything that still depends on provider authorization or commercial launch approval.</p></section>'+
    '<section class="grid">'+cards+'</section>'+
    '<article class="doc"><h2>Current commercial state</h2><p>Checkout policy: <strong>'+esc(commercial.checkoutPolicy)+'</strong>. Paid checkout enabled: <strong>'+esc(commercial.paidCheckoutEnabled)+'</strong>.</p><div class="notice">If a workflow says it is unavailable, do not work around the lock. The Studio is intentionally designed to fail closed until the required trust boundary is satisfied.</div><p class="foot"><a href="/getting-started">Getting started</a> · <a href="/pricing">Pricing</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="https://sauceapproved-ads-engine.floot.app/products">Ads Engine</a></p></article>');
}

export function renderStudioLandingShell(){
  const commercial=createStudioCommercialManifest();
  const planCards=commercial.plans.map((plan,index)=>
    '<article class="plan '+(index===1?'featured':'')+'"><span class="count">0'+(index+1)+'</span><h2>'+esc(plan.name)+'</h2><div class="price">$'+esc(plan.monthlyUsd)+'<small>/month</small></div><p>'+esc(plan.features.slice(0,2).join(" · "))+'</p><a class="cta" href="/pricing">See plan</a></article>'
  ).join("");
  const products=[
    ["Hercules Video","/operator","Brief → storyboard → shot plan → routing → quality → assembly → evidence."],
    ["Content Multiplier","/content-multiplier","Turn one approved source into governed platform-ready content branches."],
    ["Brand Brain","/brand-brain","Keep brand rules versioned, reviewable and consistent across channels."],
    ["AI Sales Agent","/ai-sales-agent","Ground sales conversations in approved product facts and controlled handoffs."],
    ["Vintage Camera","/vintage-camera","Local-first capture with quality checks, QA receipts and device proof."],
    ["Kids Studio","/kids","Child-focused creative surfaces with explicit safety and review boundaries."]
  ];
  const productCards=products.map((item,i)=>'<article class="plan"><span class="count">'+String(i+1).padStart(2,"0")+'</span><h2>'+esc(item[0])+'</h2><p>'+esc(item[2])+'</p><a class="cta" href="'+esc(item[1])+'">Open</a></article>').join("");
  return wrap("SauceApproved Studio",
    '<section class="hero"><div class="eyebrow">SAUCEAPPROVED / HERCULES-POWERED CREATIVE SYSTEM</div><h1>One Studio. A controlled creative production chain.</h1><p class="lead">SauceApproved Studio turns creative work into a visible system instead of a black box: brief, planning, generation routing, quality checks, assembly, recovery and evidence all stay connected.</p><div class="notice">Founding Customer release. Paid checkout remains locked until SauceApproved finishes owner approvals and live payment verification.</div><p class="foot"><a href="/getting-started">Getting started</a> · <a href="/operator">Open operator workspace</a> · <a href="/market">Explore Studio modules</a> · <a href="/support">Support</a></p></section>'+
    '<section class="grid">'+productCards+'</section>'+
    '<article class="doc"><div class="eyebrow">TWO HERCULES DIFFERENTIATORS</div><h2>Evidence-first production</h2><p>Run identity, shot state, quality gates, recovery and final-output proof stay visible so teams can see what was actually verified.</p><h2>Provider-transparent routing</h2><p>External models stay replaceable rendering backends. Hercules keeps the workflow brain, routing, provenance and fail-closed controls in the owned SauceApproved layer.</p></article>'+
    '<section class="grid">'+planCards+'</section>'+
    '<article class="doc"><h2>Commercial state</h2><p>Plans are public for evaluation. Checkout policy: <strong>'+esc(commercial.checkoutPolicy)+'</strong>. Paid checkout enabled: <strong>'+esc(commercial.paidCheckoutEnabled)+'</strong>.</p><p class="foot"><a href="/pricing">Pricing</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="https://sauceapproved-ads-engine.floot.app/products">SauceApproved Ads Engine</a></p></article>');
}

