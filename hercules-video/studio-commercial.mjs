
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");}
const wrap=(title,body)=>'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>'+esc(title)+'</title><style>:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#050505;color:#f6f6f6}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 20% 0,#282020 0,#0b0b0b 38%,#040404 76%)}main{width:min(1180px,100%);margin:auto;padding:clamp(18px,4vw,46px)}a{color:#e0b5aa;text-decoration:none}.hero,.doc{margin-top:22px;padding:clamp(24px,5vw,52px);border:1px solid #332a28;border-radius:28px;background:linear-gradient(145deg,#181312,#0b0b0b)}.eyebrow{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#c9978c}h1{font-size:clamp(42px,8vw,82px);line-height:.94;letter-spacing:-.05em;margin:12px 0 18px}.lead,.doc p{color:#aaa;line-height:1.65}.notice{margin-top:20px;padding:15px 17px;border:1px solid #5a4325;border-radius:15px;background:#1d150d;color:#efcb8d}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px}.plan{display:flex;flex-direction:column;gap:14px;padding:24px;border:1px solid #292525;border-radius:22px;background:#0d0d0dee}.plan.featured{border-color:#a56e61}.count{font-size:11px;letter-spacing:.18em;color:#8d7069}.plan h2{font-size:28px;margin:20px 0 0}.price{font-size:44px;font-weight:900}.price small{font-size:13px;color:#888;margin-left:5px}.plan p{color:#aaa}.plan ul{padding-left:20px;color:#bbb;line-height:1.8;flex:1}.cta{display:block;text-align:center;padding:13px;border-radius:13px;background:#f3f3f3;color:#070707;font-weight:850}.foot{margin-top:18px;color:#777;font-size:13px;line-height:1.55}.doc{max-width:900px;margin:22px auto 0}.doc h2{margin:28px 0 8px}.meta{color:#777!important}@media(max-width:820px){.grid{grid-template-columns:1fr}.hero,.doc{border-radius:22px}}</style></head><body><main><a href="/">← SauceApproved Studio</a>'+body+'</main></body></html>';

export const STUDIO_COMMERCIAL_PLANS=Object.freeze([
  Object.freeze({code:"starter",name:"Starter",monthlyUsd:29,tag:"For solo creators and small businesses.",features:Object.freeze(["Studio workspace access","Project brief + storyboard workflow","Quality and evidence views","Vintage Camera + Kids Studio"])}),
  Object.freeze({code:"pro",name:"Pro",monthlyUsd:79,tag:"For growing brands producing more creative.",features:Object.freeze(["Everything in Starter","Content Multiplier","Brand Brain","AI Sales Agent surface","Expanded production workflow"])}),
  Object.freeze({code:"business",name:"Business",monthlyUsd:199,tag:"For teams and higher-volume creative operations.",features:Object.freeze(["Everything in Pro","Business-ready workflow lane","Higher-volume creative operations","Priority commercial onboarding","Cross-product Ads Engine path"])})
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
      issue:"DA-39"
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

export function renderStudioLegalShell(kind){
  const privacy=kind==="privacy";
  const title=privacy?"Privacy Policy":"Terms of Service";
  const sections=privacy?[
    ["Information handled","Studio may process account and workspace information, creative briefs, project inputs, generated outputs, technical logs, run evidence, subscription status and support information required to provide and secure the service."],
    ["AI and rendering providers","When a requested workflow uses an external model or rendering backend, authorized inputs may be sent to that provider for generation or analysis. Hercules keeps provider routing behind an adapter boundary and does not represent an unavailable provider as connected."],
    ["Security and provenance","Studio uses fail-closed controls, evidence tracking, run fingerprints and authorization boundaries. No system can guarantee absolute security."],
    ["Payments","Payment-card data is intended to be handled by the connected payment processor rather than stored directly in the Studio application. Subscription identifiers and entitlement state may be retained to control access."],
    ["Choices and retention","Customers choose what creative inputs to submit and whether to connect supported providers. Information may be retained as reasonably required for service delivery, security, billing, audit, dispute resolution and legal obligations."]
  ]:[
    ["Subscription access","A paid Studio plan grants limited access to the subscribed software service during an active billing period. SauceApproved software, source code, orchestration logic, branding and intellectual property are not sold or transferred to the customer."],
    ["Creative and AI outputs","Generated material can contain errors and must be reviewed before commercial publication. SauceApproved does not guarantee that an output will meet every platform, legal, brand or business requirement."],
    ["Third-party providers","External AI, rendering, storage or other providers may be used as replaceable backends. Their separate terms, availability and restrictions can apply."],
    ["Acceptable use","The service may not be used for unlawful conduct, rights infringement, malicious software, deceptive impersonation, unauthorized access, or bypassing third-party security and permission controls."],
    ["Billing and launch state","Pricing may be displayed before paid checkout is enabled. A subscription is not created unless an authorized checkout successfully completes. SauceApproved may keep checkout disabled until billing, payout and refund controls are verified."],
    ["Availability","Features may change as the product develops. Provider-dependent functions may remain disabled when a trusted execution bridge or provider authorization is unavailable."]
  ];
  const body='<article class="doc"><div class="eyebrow">'+(privacy?'SAUCEAPPROVED STUDIO / PRIVACY':'SAUCEAPPROVED STUDIO / COMMERCIAL TERMS')+'</div><h1>'+title+'</h1><p class="meta">Prepared for founding-customer launch · September 29, 2026</p><div class="notice"><b>Owner approval pending.</b> Paid checkout remains locked; this public draft is provided for launch review and transparency.</div>'+sections.map(s=>'<h2>'+esc(s[0])+'</h2><p>'+esc(s[1])+'</p>').join('')+'<p><a href="/pricing">Pricing</a> · <a href="'+(privacy?'/terms':'/privacy')+'">'+(privacy?'Terms':'Privacy')+'</a></p></article>';
  return wrap("SauceApproved Studio "+title,body);
}
