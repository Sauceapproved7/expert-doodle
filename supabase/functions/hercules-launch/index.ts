import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U = Deno.env.get("SUPABASE_URL") || "https://xbwuablxhhwsaoomsoco.supabase.co";
const P = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
const K = P.default || Deno.env.get("SUPABASE_ANON_KEY") || "";
const S = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function authenticatedUser(req:Request){
  const auth=req.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer ")||!K)return null;
  try{
    const response=await fetch(U+"/auth/v1/user",{
      headers:{apikey:K,authorization:auth},
      signal:AbortSignal.timeout(10000)
    });
    if(!response.ok)return null;
    const user=await response.json();
    return typeof user?.id==="string"?user:null;
  }catch{return null}
}

async function serviceRpc(name:string,body:Record<string,unknown>){
  if(!S)throw new Error("service_role_unavailable");
  const response=await fetch(U+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{apikey:S,authorization:"Bearer "+S,"content-type":"application/json"},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(15000)
  });
  const text=await response.text();
  let payload:any=null;
  try{payload=text?JSON.parse(text):null}catch{payload=text}
  if(!response.ok){
    const detail=String(payload?.message||payload?.error||payload||"bootstrap_failed").slice(0,500);
    throw new Error(detail);
  }
  return payload;
}

async function restInsert(table:string,row:Record<string,unknown>){
  if(!S) throw new Error("marketing_storage_unavailable");
  const r=await fetch(U+"/rest/v1/"+table,{method:"POST",headers:{"content-type":"application/json","apikey":S,"authorization":"Bearer "+S,"prefer":"return=minimal"},body:JSON.stringify(row),signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error("storage_"+r.status);
}
async function existingPilot(email:string){
  if(!S)return false;
  const q=new URL(U+"/rest/v1/marketing_contacts");
  q.searchParams.set("email","eq."+email);
  q.searchParams.set("campaign","eq.founding-100-revenue-recovery");
  q.searchParams.set("select","id");
  q.searchParams.set("limit","1");
  const r=await fetch(q,{headers:{"apikey":S,"authorization":"Bearer "+S},signal:AbortSignal.timeout(10000)});
  if(!r.ok)return false;
  const rows=await r.json().catch(()=>[]);
  return Array.isArray(rows)&&rows.length>0;
}
function cleanText(v:unknown,max=240){return String(v??"").trim().slice(0,max)}
function validEmail(v:string){return v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)}
function hexUpper(bytes:ArrayBuffer){return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase()}
async function compromisedPasswordCount(password:string){
  if(typeof password!=="string"||password.length<12||password.length>256)throw new Error("password_length_invalid");
  const hash=await crypto.subtle.digest("SHA-1",new TextEncoder().encode(password));
  const digest=hexUpper(hash);
  const prefix=digest.slice(0,5);
  const suffix=digest.slice(5);
  const response=await fetch("https://api.pwnedpasswords.com/range/"+prefix,{
    method:"GET",
    headers:{"Add-Padding":"true","User-Agent":"Hercules-Password-Safety/1.0"},
    signal:AbortSignal.timeout(7000)
  });
  if(!response.ok)throw new Error("password_safety_upstream_"+response.status);
  const responseBody=await response.text();
  for(const line of responseBody.split(/\r?\n/)){
    const [remoteSuffix,countRaw]=line.trim().split(":");
    if(remoteSuffix&&remoteSuffix.toUpperCase()===suffix){
      const count=Number(countRaw||0);
      return Number.isFinite(count)&&count>0?Math.trunc(count):1;
    }
  }
  return 0;
}
async function screenPasswordServer(password:string){
  if(typeof password!=="string"||password.length<12||password.length>256)return {ok:false,error:"weak_password_length",status:400};
  try{
    const breached=await compromisedPasswordCount(password);
    if(breached>0)return {ok:false,error:"compromised_password",status:422};
    return {ok:true,error:null,status:200};
  }catch{
    return {ok:false,error:"password_safety_unavailable",status:503};
  }
}
async function issuePasswordTicket(purpose:"signup"|"change_password",email:string|null,userId:string|null){
  if(!S)throw new Error("service_role_unavailable");
  const r=await fetch(U+"/rest/v1/rpc/hercules_password_screening_issue",{
    method:"POST",
    headers:{apikey:S,authorization:"Bearer "+S,"content-type":"application/json"},
    body:JSON.stringify({p_purpose:purpose,p_email:email,p_user_id:userId,p_ttl_seconds:120}),
    signal:AbortSignal.timeout(10000)
  });
  const text=await r.text();
  if(!r.ok)throw new Error("password_screening_ticket_"+r.status);
  return String(JSON.parse(text));
}
async function serverRegistrationOpen(){
  const r=await fetch(U+"/functions/v1/hercules-launch-gate",{headers:K?{apikey:K}:{},signal:AbortSignal.timeout(10000)}).catch(()=>null);
  if(!r?.ok)return false;
  const d=await r.json().catch(()=>null);
  return Boolean(d?.lastCheck?.launch_ready===true&&d?.publicRegistrationOpen===true);
}
async function secureSignup(email:string,password:string){
  if(!await serverRegistrationOpen())return {status:403,body:{ok:false,error:"public_registration_closed"}};
  const check=await screenPasswordServer(password);
  if(!check.ok)return {status:check.status,body:{ok:false,error:check.error}};
  const ticket=await issuePasswordTicket("signup",email,null);
  const r=await fetch(U+"/auth/v1/signup",{
    method:"POST",
    headers:{apikey:K,authorization:"Bearer "+K,"content-type":"application/json"},
    body:JSON.stringify({email,password,data:{hercules_password_screening_ticket:ticket}}),
    signal:AbortSignal.timeout(15000)
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok)return {status:r.status,body:{ok:false,error:d?.msg||d?.message||d?.error||"signup_failed"}};
  return {status:200,body:{ok:true,user:d?.user||null,session:d?.access_token?{access_token:d.access_token,refresh_token:d.refresh_token}:null}};
}
async function securePasswordChange(req:Request,password:string,nonce:string,currentPassword:string){
  const auth=req.headers.get("authorization")||"";
  const user=await authenticatedUser(req);
  if(!user)return {status:401,body:{ok:false,error:"authenticated_user_required"}};
  const check=await screenPasswordServer(password);
  if(!check.ok)return {status:check.status,body:{ok:false,error:check.error}};
  const ticket=await issuePasswordTicket("change_password",null,user.id);
  const data={...(user.user_metadata||{}),hercules_password_screening_ticket:ticket};
  const body:any={password,data};
  if(nonce)body.nonce=nonce;
  if(currentPassword)body.current_password=currentPassword;
  const r=await fetch(U+"/auth/v1/user",{
    method:"PUT",
    headers:{apikey:K,authorization:auth,"content-type":"application/json"},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(15000)
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok)return {status:r.status,body:{ok:false,error:d?.msg||d?.message||d?.error||"password_change_failed"}};
  return {status:200,body:{ok:true,user:d}};
}
const PUBLIC_MARKETING_EVENTS=new Set(["landing_view","cta_open_product","proof_demo_interest","pilot_interest","proof_demo_started","first_verified_useful_action"]);
const PRIVACY_REQUEST_CATEGORIES=new Set(["privacy_access","privacy_export","privacy_correction","privacy_deletion","privacy_question","support","legal_inquiry"]);
async function recentPrivacyRequestCount(email:string){
  if(!S)return 99;
  const q=new URL(U+"/rest/v1/hercules_privacy_requests");
  q.searchParams.set("email","eq."+email);
  q.searchParams.set("created_at","gte."+new Date(Date.now()-24*60*60*1000).toISOString());
  q.searchParams.set("select","id");
  q.searchParams.set("limit","6");
  const r=await fetch(q,{headers:{apikey:S,authorization:"Bearer "+S},signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error("privacy_request_rate_check_failed");
  const rows=await r.json().catch(()=>[]);
  return Array.isArray(rows)?rows.length:99;
}
function safeMarketingProperties(value:unknown){
  const input=value&&typeof value==="object"?value as Record<string,unknown>:{};
  return {
    path:cleanText(input.path,500)||null,
    referrer:cleanText(input.referrer,500)||null,
    surface:cleanText(input.surface,80)||null,
    dataset:cleanText(input.dataset,80)||null,
    project_id:cleanText(input.project_id,80)||null,
    source:cleanText(input.source,100)||null,
    medium:cleanText(input.medium,100)||null,
    campaign:cleanText(input.campaign,120)||null,
    content:cleanText(input.content,120)||null,
    attribution_id:cleanText(input.attribution_id,80)||null
  };
}

const html = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#070707">
<meta name="description" content="Hercules Revenue Recovery turns receivables evidence into controlled next actions with approvals, verification, and proof.">
<title>Hercules Revenue Recovery by SauceApproved</title>
<style>
:root{color-scheme:dark;--bg:#070707;--panel:#111214;--panel2:#17181b;--line:#2a2c31;--text:#f6f7f8;--muted:#9da3ad;--soft:#cdd1d7;--good:#86e4a6;--warn:#efc66d;--bad:#ff9595}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 18% -10%,#242833 0,transparent 30%),radial-gradient(circle at 85% 10%,#171c27 0,transparent 24%),var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;min-height:100vh}
button,input,select,textarea{font:inherit;font-size:16px}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,a:focus-visible{outline:2px solid #fff;outline-offset:2px}a{color:inherit}.hidden{display:none!important}
.shell{max-width:1220px;margin:auto;padding:18px 20px 46px}.top{position:sticky;top:0;z-index:50;margin:0 -20px;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;background:rgba(7,7,7,.84);backdrop-filter:blur(18px);border-bottom:1px solid rgba(255,255,255,.07)}
.brandwrap{display:flex;align-items:center;gap:10px}.mark{width:34px;height:34px;border:1px solid #50545d;border-radius:10px;display:grid;place-items:center;font-weight:950;letter-spacing:-.06em;background:linear-gradient(145deg,#f4f5f7,#8d96a8);color:#090a0c;box-shadow:0 0 34px rgba(210,222,255,.12)}.brand{font-weight:950;letter-spacing:.14em;font-size:17px}.tag{font-size:11px;text-transform:uppercase;letter-spacing:.17em;color:var(--muted)}
.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.navlinks{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.btn{min-height:43px;border:1px solid var(--line);background:#18191d;color:#fff;border-radius:12px;padding:10px 14px;font-weight:800;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px}.btn:hover{background:#202228}.btn.primary{background:#f2f4f7;color:#070809;border-color:#f2f4f7}.btn.primary:hover{background:#dfe3e9}.btn.ghost{background:transparent}.btn.small{min-height:38px;padding:8px 11px;font-size:14px}
.pill{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:6px 9px;font-size:12px;color:var(--soft);background:rgba(255,255,255,.025)}.dot{width:8px;height:8px;border-radius:50%;background:#747983}.dot.good{background:var(--good)}.dot.warn{background:var(--warn)}.dot.bad{background:var(--bad)}
.hero{padding:76px 0 38px;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr);gap:34px;align-items:center}.hero h1{font-size:clamp(58px,10vw,116px);line-height:.84;letter-spacing:-.075em;margin:12px 0 22px}.hero .sub{font-size:clamp(21px,3vw,34px);font-weight:750;letter-spacing:-.025em;color:#d8dce4}.hero p{font-size:18px;line-height:1.65;color:#aeb4be;max-width:760px}
.commandbox,.panel,.card{border:1px solid var(--line);background:linear-gradient(180deg,rgba(27,29,34,.96),rgba(15,16,19,.96));border-radius:20px}.commandbox{padding:18px;box-shadow:0 34px 80px -50px rgba(205,220,255,.3)}.commandbox textarea,.input{width:100%;border:1px solid #343740;background:#0a0b0d;color:#fff;border-radius:13px;padding:13px}.commandbox textarea{min-height:150px;resize:vertical;line-height:1.55}.commandmeta{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap}
.grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px}.card{padding:18px}.card h3{margin:8px 0;font-size:20px}.card p{margin:0;color:var(--muted);line-height:1.55}.section{padding:36px 0}.section h2{font-size:clamp(34px,5vw,58px);letter-spacing:-.045em;margin:8px 0 18px}.pipeline{display:grid;grid-template-columns:repeat(5,1fr);gap:9px}.step{border:1px solid var(--line);border-radius:14px;padding:15px 12px;background:#0d0e11}.step b{display:block;margin-bottom:6px}.step span{font-size:13px;color:var(--muted)}.proof{display:grid;grid-template-columns:1.2fr .8fr;gap:14px}.panel{padding:20px}.panel h2,.panel h3{margin-top:5px}.featurelist{display:grid;gap:10px}.feature{display:flex;justify-content:space-between;gap:12px;border:1px solid #292b31;border-radius:12px;padding:12px;background:#0d0e11}.footer{border-top:1px solid var(--line);margin-top:44px;padding-top:24px;color:#777d87;font-size:13px;display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap}.legal{max-width:820px}.legal h3{color:#fff}.legal p{line-height:1.65}
.authwrap{min-height:78vh;display:grid;place-items:center;padding:50px 0}.authcard{width:min(520px,100%);padding:22px}.authcard h1{font-size:40px;margin:8px 0 18px}.input{min-height:48px;margin-top:10px}.notice{margin-top:12px;padding:12px;border:1px solid #474a52;border-radius:12px;color:var(--soft);white-space:pre-wrap;overflow-wrap:anywhere}.notice.good{border-color:#27583a;color:var(--good)}.notice.bad{border-color:#6a3030;color:var(--bad)}.notice.warn{border-color:#6b5728;color:var(--warn)}
.appgrid{display:grid;grid-template-columns:226px minmax(0,1fr);gap:18px;padding-top:22px}.sidebar{position:sticky;top:78px;align-self:start;padding:13px}.sidebtn{width:100%;justify-content:flex-start;margin:4px 0;background:transparent}.sidebtn.active{background:#f1f3f6;color:#070809;border-color:#f1f3f6}.workspace{min-width:0}.adstudio-frame{display:block;width:100%;min-height:78vh;border:1px solid var(--line);border-radius:18px;background:#0c0f13}.view{display:none}.view.active{display:block}.viewhead{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;margin-bottom:16px}.viewhead h1{font-size:clamp(32px,5vw,52px);letter-spacing:-.04em;margin:5px 0}.muted{color:var(--muted)}
.chat{display:grid;grid-template-rows:minmax(320px,1fr) auto;min-height:72vh}.messages{display:flex;flex-direction:column;gap:12px;overflow:auto;padding:8px 2px 20px;max-height:62vh}.msg{max-width:min(820px,90%);padding:13px 15px;border-radius:16px;line-height:1.58;white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid var(--line)}.msg.user{align-self:flex-end;background:#eceff3;color:#090a0c;border-color:#eceff3}.msg.ai{align-self:flex-start;background:#121318}.msg.meta{font-size:12px;color:var(--muted);background:transparent;border-style:dashed}.composer{border-top:1px solid var(--line);padding-top:14px}.composer textarea{min-height:100px}
.results{display:grid;gap:10px;margin-top:14px}.result{border:1px solid var(--line);border-radius:13px;padding:13px;background:#0e0f12}.result h3{margin:0 0 6px}.result p{margin:0;color:var(--muted);line-height:1.5}.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.kpi b{font-size:26px;display:block;margin-top:6px}.statusline{display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #25272c;padding:11px 0}.statusline:last-child{border-bottom:0}.deployrow{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center}.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}.progress{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-top:12px}.progress div{padding:9px;border:1px solid var(--line);border-radius:10px;text-align:center;font-size:12px;color:var(--muted)}.progress .active{border-color:#776126;color:var(--warn)}.progress .done{border-color:#2d6040;color:var(--good)}
@media(max-width:900px){.hero,.proof,.appgrid,.two{grid-template-columns:1fr}.grid4,.three{grid-template-columns:1fr 1fr}.pipeline{grid-template-columns:1fr}.sidebar{position:static;display:flex;overflow:auto;gap:7px;padding:9px}.sidebtn{min-width:max-content;margin:0}.chat{min-height:64vh}}
@media(max-width:620px){.shell{padding:10px 14px 32px}.top{margin:0 -14px;padding:12px 14px}.navlinks a:not(.primary){display:none}.hero{padding:44px 0 24px}.hero h1{font-size:58px}.grid4,.three{grid-template-columns:1fr}.commandbox,.panel,.card{border-radius:16px}.progress{grid-template-columns:1fr}.msg{max-width:96%}}
</style>
</head>
<body>
<div class="shell">
<header class="top">
  <div class="brandwrap"><div class="mark">H</div><div><div class="brand">HERCULES</div><div class="tag">by SauceApproved</div></div></div>
  <nav class="navlinks" id="publicNav"><a class="btn ghost small" href="#revenue-recovery">Recovery</a><a class="btn ghost small" href="#proof-demo">Proof</a><a class="btn ghost small" href="#trust">Trust</a><a class="btn ghost small" href="#pilot">Pilot</a><button class="btn primary small" id="openHercules">Open Hercules</button></nav>
  <div class="row hidden" id="appActions"><span class="pill" id="livePill"><span class="dot"></span>Checking</span><button class="btn small" id="signOut">Sign out</button></div>
</header>

<section id="landing">
  <section class="hero">
    <div>
      <div class="tag">Revenue Recovery · Early Access</div>
      <h1>HERCULES</h1>
      <div class="sub">Recover cash. Keep control. Prove every action.</div>
      <p>Hercules Revenue Recovery turns overdue B2B receivables into an evidence-backed next step. It separates routine follow-up from disputes, promises to pay, paid evidence, and human-review cases while preserving approval boundaries.</p>
      <div class="row"><span class="pill">Evidence first</span><span class="pill">Human approval</span><span class="pill">Verified action history</span><span class="pill">No black box</span></div>
      <div class="row" style="margin-top:18px"><a class="btn primary" href="#proof-demo" id="heroProof">Watch Hercules prove it</a><a class="btn" href="#pilot" id="heroPilot">Request founding pilot</a></div>
    </div>
    <div class="commandbox">
      <div class="tag">Synthetic proof case</div>
      <h2 style="margin:8px 0 12px">$18,400 overdue · 3 invoices</h2>
      <p class="muted">One invoice has a payment promise. One has a dispute. One is a clean follow-up candidate. Hercules should not treat them the same.</p>
      <div class="featurelist" style="margin-top:14px"><div class="feature"><span>Current state</span><span class="pill">verified evidence</span></div><div class="feature"><span>Next action</span><span class="pill">reasoned route</span></div><div class="feature"><span>Consequential action</span><span class="pill">approval gated</span></div><div class="feature"><span>Outcome</span><span class="pill">proof retained</span></div></div>
    </div>
  </section>

  <section class="section" id="revenue-recovery">
    <div class="tag">Hercules Revenue Recovery</div><h2>Receivables evidence in. Controlled action out.</h2>
    <div class="grid4">
      <div class="card"><div class="tag">01 · Observe</div><h3>Establish current state</h3><p>Use invoice, payment, dispute, and relationship evidence to determine what is actually true now.</p></div>
      <div class="card"><div class="tag">02 · Reason</div><h3>Explain the route</h3><p>Produce an inspectable reason for the next step rather than hiding logic behind an automation score.</p></div>
      <div class="card"><div class="tag">03 · Control</div><h3>Gate consequences</h3><p>Keep consequential external actions behind explicit human approval and permission boundaries.</p></div>
      <div class="card"><div class="tag">04 · Prove</div><h3>Preserve the receipt</h3><p>Keep evidence of what Hercules saw, proposed, approved, executed, and verified.</p></div>
    </div>
  </section>

  <section class="section" id="proof-demo">
    <div class="tag">60–90 second proof demo</div><h2>Same overdue balance. Three different truths.</h2>
    <div class="three">
      <div class="card"><div class="tag">Synthetic demo data</div><h3>Invoice A · $8,400</h3><p>31 days overdue. No dispute. No payment promise. Route: prepare controlled follow-up.</p></div>
      <div class="card"><div class="tag">Synthetic demo data</div><h3>Invoice B · $6,000</h3><p>18 days overdue. Customer disputed line items. Route: human review; do not send routine collection follow-up.</p></div>
      <div class="card"><div class="tag">Synthetic demo data</div><h3>Invoice C · $4,000</h3><p>12 days overdue. Payment promised for Friday. Route: hold until promise window; verify before acting.</p></div>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="tag">Live walkthrough</div><h3 id="demoHeadline">Ready to run the proof.</h3>
      <p class="muted" id="demoDetail">Run the synthetic case to watch Hercules move through evidence, state, route, approval, verification, and proof.</p>
      <div class="progress" id="demoProgress"><div>Evidence</div><div>State</div><div>Route</div><div>Approval</div><div>Proof</div></div>
      <button class="btn primary" style="margin-top:14px" id="demoRun">Run proof demo</button>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="tag">5-minute workflow</div><h3>From receivable to verified useful action</h3>
      <div class="featurelist"><div class="feature"><span>Minute 1 · Import supported receivable evidence</span><span class="pill">source preserved</span></div><div class="feature"><span>Minute 2 · Determine current case state</span><span class="pill">reason codes</span></div><div class="feature"><span>Minute 3 · Plan smallest safe route</span><span class="pill">no blind escalation</span></div><div class="feature"><span>Minute 4 · Review consequential action</span><span class="pill">human approval</span></div><div class="feature"><span>Minute 5 · Verify result and retain proof</span><span class="pill">audit trail</span></div></div>
    </div>
  </section>

  <section class="section proof" id="trust">
    <div class="panel"><div class="tag">Hercules Trust Center</div><h2>Trust the evidence.</h2><div class="featurelist"><div class="feature"><span>Owner-code provenance controls</span><span class="pill">implemented</span></div><div class="feature"><span>Customer workspace boundaries</span><span class="pill">tested</span></div><div class="feature"><span>Public registration release gate</span><span class="pill">fail closed</span></div><div class="feature"><span>Revenue Recovery approval boundary</span><span class="pill">implemented</span></div></div></div>
    <div class="panel"><div class="tag">What is not proven yet</div><h3>No fake maturity claims.</h3><p class="muted">General availability, final paid pricing, final legal terms, production retention commitments, and unrestricted public registration remain owner/review gated. Staging evidence is not represented as production uptime history.</p></div>
  </section>

  <section class="section proof" id="security">
    <div class="panel"><div class="tag">Security</div><h3>Fail closed where consequences matter.</h3><p class="muted">Customer isolation, permission boundaries, approval gates, provenance checks, and release gates are part of the launch architecture. Security claims remain limited to verified controls.</p></div>
    <div class="panel"><div class="tag">Legal / privacy status</div><h3>DRAFT — owner review required before general availability.</h3><p class="muted">The prepared Terms and Privacy drafts must match final production providers, retention, billing, support, and launch-market scope before they become effective.</p></div>
  </section>

  <section class="section" id="pilot">
    <div class="tag">Founding 100</div><h2>Founding Revenue Recovery Pilot</h2><div class="notice good"><b>Founding Pilot applications are open.</b> Controlled pilot intake is live. Paid billing and general public account creation remain closed.</div>
    <div class="two">
      <form class="panel" id="pilotForm">
        <div class="tag">Pilot intake</div><h3>Request a controlled evaluation.</h3>
        <label class="tag" for="pilotName">Name</label><input class="input" id="pilotName" maxlength="100" autocomplete="name" placeholder="Your name">
        <label class="tag" for="pilotEmail" style="display:block;margin-top:12px">Business email</label><input class="input" id="pilotEmail" type="email" maxlength="254" required autocomplete="email" placeholder="you@company.com">
        <label class="tag" for="pilotCompany" style="display:block;margin-top:12px">Company</label><input class="input" id="pilotCompany" maxlength="160" autocomplete="organization" placeholder="Company name">
        <label class="tag" for="pilotRole" style="display:block;margin-top:12px">Role</label><select class="input" id="pilotRole"><option>Owner / Founder</option><option>Finance / AR</option><option>Accountant / Bookkeeper</option><option>Fractional CFO / Consultant</option><option>Agency / Operator</option><option>Other</option></select>
        <input class="hidden" id="pilotWebsite" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn primary" style="width:100%;margin-top:14px" type="submit">Request founding pilot</button>
        <div class="notice hidden" id="pilotMsg"></div>
      </form>
      <div class="panel">
        <div class="tag">What the pilot delivers</div><h3>One narrow receivables workflow, finished end to end.</h3>
        <p class="muted">Built for U.S. businesses managing their own commercial receivables. The pilot starts with supported receivable evidence, routes each case through the live Recovery Desk, protects blocked states, and preserves the resulting proof trail.</p>
        <div class="featurelist" style="margin-top:14px">
          <div class="feature"><span>Workspace</span><span class="pill">Recovery Desk</span></div>
          <div class="feature"><span>Goal</span><span class="pill">First verified useful action</span></div>
          <div class="feature"><span>Data</span><span class="pill">Synthetic until authorized</span></div>
          <div class="feature"><span>Unsafe cases</span><span class="pill">human review only</span></div>
          <div class="feature"><span>External action</span><span class="pill">approval gated</span></div>
        </div>
        <p class="muted" style="margin-top:14px">Commercial terms remain owner-gated. Current pricing material is a proposal, not active billing. Hercules is not being offered here as consumer debt collection, third-party collections, credit scoring, legal collections, or a guaranteed recovery service.</p>
      </div>
    </div>
  </section>

  <section class="section" id="build-receipt-001">
    <div class="tag">Build Receipt #001</div><h2>Three receivables. Three safe routes.</h2>
    <div class="proof">
      <div class="panel">
        <div class="tag">What Hercules proved</div>
        <h3>It did not treat every overdue invoice as the same problem.</h3>
        <p class="muted">Using synthetic evidence, Hercules separated a routine overdue invoice, a disputed invoice, and a payment-promise case. The routes diverged before any consequential external action was allowed.</p>
        <div class="featurelist" style="margin-top:14px">
          <div class="feature"><span>$8,400 · routine overdue</span><span class="pill">controlled follow-up</span></div>
          <div class="feature"><span>$6,000 · disputed</span><span class="pill">human review</span></div>
          <div class="feature"><span>$4,000 · promised payment</span><span class="pill">hold + verify</span></div>
        </div>
      </div>
      <div class="panel">
        <div class="tag">Evidence boundary</div>
        <h3>Proof, not a recovery claim.</h3>
        <p class="muted">This receipt demonstrates workflow behavior on synthetic data. It does not claim a recovery rate, customer savings, production uptime history, or guaranteed collections outcomes.</p>
        <a class="btn primary" href="#pilot" style="margin-top:14px">Request founding pilot</a>
      </div>
    </div>
  </section>

  <section class="section" id="capabilities">
    <div class="tag">Capabilities</div><h2>One system. Four operating lanes.</h2>
    <div class="grid4">
      <div class="card"><div class="tag">01</div><h3>Research</h3><p>Search the Hercules knowledge registry and use verified references to ground decisions.</p></div>
      <div class="card"><div class="tag">02</div><h3>Build</h3><p>Turn a goal into a structured build and run it through the Forge builder pipeline.</p></div>
      <div class="card"><div class="tag">03</div><h3>Deploy</h3><p>Publish through the SauceApproved-owned deployment runtime with version history and verification.</p></div>
      <div class="card"><div class="tag">04</div><h3>Operate</h3><p>See control-plane state, release activity, knowledge status, and live system readiness.</p></div>
    </div>
  </section>

  <section class="section">
    <div class="tag">How Hercules works</div><h2>Ask → Plan → Execute → Verify → Deliver</h2>
    <div class="pipeline"><div class="step"><b>ASK</b><span>State the outcome.</span></div><div class="step"><b>PLAN</b><span>Hercules chooses the path.</span></div><div class="step"><b>EXECUTE</b><span>Agents and services do the work.</span></div><div class="step"><b>VERIFY</b><span>Evidence checks the result.</span></div><div class="step"><b>DELIVER</b><span>You get the usable output.</span></div></div>
  </section>

  <section class="section proof" id="system">
    <div class="panel"><div class="tag">Real control plane</div><h2>Not a mock dashboard.</h2><p class="muted">The launch interface sits on the Hercules services already running in the SauceApproved stack. It does not fabricate build status or deployment results.</p><div class="featurelist" style="margin-top:16px"><div class="feature"><span>Knowledge registry</span><span class="pill">live data</span></div><div class="feature"><span>Hercules AI</span><span class="pill">real provider chain</span></div><div class="feature"><span>Forge Builder</span><span class="pill">real build/deploy</span></div><div class="feature"><span>Control plane</span><span class="pill">real state</span></div></div></div>
    <div class="panel"><div class="tag">Launch boundary</div><h3>Clean outside. Deep inside.</h3><p class="muted">The public product stays simple. Detailed operational controls remain behind authenticated owner/admin access.</p><button class="btn primary" style="margin-top:14px" id="systemOpen">Enter Hercules</button></div>
  </section>

  <section class="section legal" id="privacyRequestCenter">
    <div class="tag">Privacy & support</div>
    <h3>Hercules Privacy Request Center</h3>
    <p>Submit an access, export, correction, deletion, privacy, support, or business/legal inquiry. Hercules records the request and returns a reference. Identity or authority must be verified before any customer data is exported, corrected, or deleted.</p>
    <form id="privacyForm" class="panel" style="margin-top:16px">
      <label for="privacyRequestType">Request type</label>
      <select id="privacyRequestType" required>
        <option value="privacy_access">Access my data</option>
        <option value="privacy_export">Export my data</option>
        <option value="privacy_correction">Correct my data</option>
        <option value="privacy_deletion">Delete my data</option>
        <option value="privacy_question">Privacy question</option>
        <option value="support">Customer support</option>
        <option value="legal_inquiry">Business/legal inquiry</option>
      </select>
      <label for="privacyEmail" style="margin-top:12px">Business email</label>
      <input id="privacyEmail" type="email" autocomplete="email" maxlength="254" required placeholder="you@company.com">
      <label for="privacyMessage" style="margin-top:12px">Request details</label>
      <textarea id="privacyMessage" minlength="10" maxlength="3000" required placeholder="Describe what you need. Do not include authentication codes, payment-card numbers, or government identifiers."></textarea>
      <div class="hidden" aria-hidden="true"><label for="privacyWebsite">Website</label><input id="privacyWebsite" tabindex="-1" autocomplete="off"></div>
      <button class="btn primary" type="submit" style="margin-top:12px">Submit request</button>
      <div id="privacyRequestMsg" class="notice hidden"></div>
    </form>
  </section>

  <section class="section legal" id="privacy"><div class="tag">Early Access</div><h3>Privacy</h3><p>Hercules uses account identifiers, workspace content, prompts, build and deployment records, and audit data to operate the service, secure access, and improve reliability. Provider credentials remain server-side where supported. Do not submit data you are not authorized to use.</p></section>
  <section class="section legal" id="terms"><div class="tag">Early Access</div><h3>Terms</h3><p>Use Hercules only with systems and data you own or are authorized to operate. Early Access features, limits, and availability may change. Any paid production commitments, support levels, or warranties require separate written terms.</p></section>
  <footer class="footer"><span>Hercules by SauceApproved</span><span>Early Access · Privacy · Terms</span></footer>
</section>

<section id="auth" class="hidden">
  <div class="authwrap"><div class="panel authcard"><div class="tag">Secure access</div><h1 id="authTitle">Sign in</h1><input class="input" id="email" type="email" autocomplete="email" placeholder="Email"><input class="input" id="password" type="password" minlength="12" autocomplete="current-password" placeholder="Password"><button class="btn primary" style="width:100%;margin-top:12px" id="authSubmit">Sign in</button><button class="btn" style="width:100%;margin-top:8px" id="authSwitch">Create account</button><button class="btn ghost" style="width:100%;margin-top:8px" id="backHome">Back</button><div class="notice hidden" id="authMsg"></div></div></div>
</section>

<section id="app" class="hidden">
  <div class="appgrid">
    <aside class="panel sidebar">
      <button class="btn sidebtn active" data-view="recoveryView">Recovery Desk</button>
      <button class="btn sidebtn" data-view="homeView">Hercules AI</button>
      <div class="tag" style="margin:18px 10px 6px">Advanced tools</div>
      <button class="btn sidebtn" data-view="knowledgeView">Knowledge</button>
      <button class="btn sidebtn" data-view="builderView">Builder</button>\n      <button class="btn sidebtn" data-view="adStudioView">Ad Studio</button>
      <button class="btn sidebtn" data-view="forgeView">Deployments</button>
      <button class="btn sidebtn" data-view="statusView">System Status</button>
      <a class="btn sidebtn" href="/hercules-wallet/">Wallet · Testnet</a>
    </aside>
    <main class="workspace">
      <section class="view active" id="recoveryView">
        <div class="viewhead"><div><div class="tag">Hercules Revenue Recovery</div><h1>Recovery Desk</h1><div class="muted">Add a receivable, establish its current state, and let Hercules route only what is safe to act on.</div></div><div class="row"><span class="pill" id="recoveryState"><span class="dot"></span>Loading cases</span><button class="btn" id="recoveryRefresh">Refresh</button></div></div>
        <div class="three" id="recoverySummary"></div>
        <div class="two" style="margin-top:14px">
          <form class="panel" id="recoveryForm">
            <div class="tag">Add receivable</div><h2 style="margin:7px 0 8px">Start with what is known.</h2><p class="muted">Hercules stores the source reference and case state. Blocked states remain human-review only and do not queue external follow-up.</p>
            <label class="tag" style="display:block;margin-top:14px">Customer / account</label><input class="input" id="recoveryCustomer" maxlength="160" placeholder="Acme Supply">
            <label class="tag" style="display:block;margin-top:14px">Invoice reference</label><input class="input" id="recoveryInvoice" maxlength="120" placeholder="INV-1042" required>
            <div class="two">
              <label class="tag" style="display:block;margin-top:14px">Amount (USD)<input class="input" id="recoveryAmount" type="number" min="0" step="0.01" placeholder="8400.00" required></label>
              <label class="tag" style="display:block;margin-top:14px">Days overdue<input class="input" id="recoveryDaysOverdue" type="number" min="0" step="1" value="1" required></label>
            </div>
            <label class="tag" style="display:block;margin-top:14px">Current case state</label>
            <select class="input" id="recoveryCaseState">
              <option value="contact_ready">Contact ready</option>
              <option value="disputed">Disputed</option>
              <option value="promise_active">Active payment promise</option>
              <option value="paid">Paid/closed</option>
              <option value="do_not_contact">Do not contact</option>
              <option value="unverified_history">Unverified history</option>
              <option value="manual_review">Manual review</option>
            </select>
            <div class="notice" id="recoveryGuidance">Contact-ready cases can queue only the channels you provide below.</div>
            <label class="tag" style="display:block;margin-top:14px">Email</label><input class="input" id="recoveryEmail" type="email" maxlength="254" placeholder="customer@example.com">
            <label class="tag" style="display:block;margin-top:14px">Phone</label><input class="input" id="recoveryPhone" maxlength="40" placeholder="+1 555 555 0123">
            <label class="tag" style="display:block;margin-top:14px">Source</label>
            <select class="input" id="recoverySource"><option value="inbound">Imported receivable</option><option value="quote_sent">Quote / invoice sent</option><option value="missed_call">Missed call</option><option value="abandoned_cart">Abandoned checkout</option></select>
            <button class="btn primary" style="width:100%;margin-top:14px" id="recoverySubmit" type="submit">Add to Recovery Desk</button>
            <div class="notice hidden" id="recoveryFormResult"></div>
          </form>
          <div class="panel"><div class="tag">Cases</div><h2 style="margin:7px 0 8px">What needs attention now.</h2><p class="muted">Contact-ready cases can have permitted follow-up queued. Disputes, active promises, paid cases, do-not-contact, unverified history, and manual-review cases stay blocked from external follow-up.</p><div class="results" id="recoveryLeads"></div></div>
        </div>
      </section>

      <section class="view" id="homeView">
        <div class="viewhead"><div><div class="tag">Hercules</div><h1>What do you want done?</h1><div class="muted">Ask a question or give Hercules a concrete goal.</div></div><span class="pill" id="aiStatus"><span class="dot"></span>AI ready check</span></div>
        <div class="panel chat"><div class="messages" id="messages"></div><div class="composer"><textarea class="input" id="chatPrompt" placeholder="Ask Hercules to research, plan, build, fix, deploy, or verify something."></textarea><div class="row" style="justify-content:space-between;margin-top:9px"><span class="muted code" id="projectLabel">Command workspace</span><button class="btn primary" id="sendChat">Send to Hercules</button></div></div></div>
      </section>

      <section class="view" id="knowledgeView">
        <div class="viewhead"><div><div class="tag">Knowledge</div><h1>Search what Hercules knows.</h1><div class="muted">Results come from the Hercules knowledge registry.</div></div><span class="pill" id="knowledgeStats">Loading registry</span></div>
        <div class="panel"><div class="row"><input class="input" style="margin:0;flex:1" id="knowledgeQuery" placeholder="Search the registry"><button class="btn primary" id="knowledgeSearch">Search</button></div><div class="results" id="knowledgeResults"></div></div>
      </section>

      <section class="view" id="builderView">
        <div class="viewhead"><div><div class="tag">Builder</div><h1>Describe it. Hercules builds it.</h1><div class="muted">The real Forge Builder plans, builds, validates, deploys, and verifies.</div></div></div>
        <div class="two">
          <form class="panel" id="builderForm"><label class="tag">App name</label><input class="input" id="buildName" value="Hercules App" maxlength="120"><label class="tag" style="display:block;margin-top:14px">Slug</label><input class="input" id="buildSlug" value="sauceapproved-app" pattern="[a-z0-9][a-z0-9-]{1,62}"><label class="tag" style="display:block;margin-top:14px">Profile</label><select class="input" id="buildProfile"><option value="full_stack">Full-stack app</option><option value="backend_service">Backend service</option><option value="integration">Integration</option></select><label class="tag" style="display:block;margin-top:14px">Goal</label><textarea class="input" style="min-height:210px;resize:vertical" id="buildGoal" maxlength="4000" placeholder="What should Hercules build?"></textarea><button class="btn primary" style="width:100%;margin-top:12px" id="buildRun" type="submit">Build & deploy</button></form>
          <div class="panel"><div class="tag">Pipeline</div><h2 id="buildState">Ready</h2><div class="progress" id="buildProgress"><div data-step="plan">PLAN</div><div data-step="build">BUILD</div><div data-step="validate">VALIDATE</div><div data-step="deploy">DEPLOY</div><div data-step="verify">VERIFY</div></div><div class="notice hidden" id="buildResult"></div></div>
        </div>
      </section>

      <section class="view" id="adStudioView">
        <div class="viewhead"><div><div class="tag">Hercules Growth Tools</div><h1>Hercules Ad Studio</h1><div class="muted">Create, plan, export, and measure ad experiments inside your signed-in Hercules workspace. Publishing and spend remain manual and approval-gated.</div></div><span class="pill">Founder workspace</span></div>
        <iframe id="adStudioFrame" class="adstudio-frame" title="Hercules Ad Studio" loading="lazy" referrerpolicy="no-referrer"></iframe>
        <div class="notice" style="margin-top:12px">The Studio loads locally inside Hercules only after you open this authenticated workspace view. Campaign data remains in this browser's local storage; do not enter secrets or customer invoice records.</div>
      </section>

      <section class="view" id="forgeView">
        <div class="viewhead"><div><div class="tag">Forge</div><h1>Deployments</h1><div class="muted">Real Hercules-owned deployment history and release evidence.</div></div><button class="btn" id="refreshDeployments">Refresh</button></div>
        <div class="panel"><div id="deploymentSummary" class="three"></div><div class="results" id="deploymentList"></div></div>
      </section>

      <section class="view" id="statusView">
        <div class="viewhead"><div><div class="tag">System status</div><h1>Hercules operating state.</h1><div class="muted">Live service responses. No invented uptime or fake success states.</div></div><button class="btn" id="refreshStatus">Refresh</button></div>
        <div class="three" id="statusCards"></div>
        <div class="two" style="margin-top:14px"><div class="panel"><div class="tag">Control plane</div><div id="controlStatus"></div></div><div class="panel"><div class="tag">Knowledge registry</div><div id="registryStatus"></div></div></div>
      </section>
    </main>
  </div>
</section>
</div>

<script type="module">
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const U="__URL__",K="__KEY__";
const sb=createClient(U,K,{auth:{persistSession:true,autoRefreshToken:true}});
const $=id=>document.getElementById(id);
let authMode="signin",user=null,project=null,orgId=null,orgSlug=null,publicSignupOpen=false;
const AD_STUDIO_SRC_B64="PCFkb2N0eXBlIGh0bWw+CjxodG1sIGxhbmc9ImVuIj48aGVhZD48bWV0YSBjaGFyc2V0PSJ1dGYtOCI+PG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCxpbml0aWFsLXNjYWxlPTEiPjx0aXRsZT5IZXJjdWxlcyBBZCBTdHVkaW88L3RpdGxlPjxzdHlsZT4KOnJvb3R7Y29sb3Itc2NoZW1lOmRhcms7LS1iZzojMGMwZjEzOy0tcGFuZWw6IzE1MWEyMDstLWxpbmU6IzJiMzEzYTstLW11dGVkOiNhOGIxYmQ7LS1nb2xkOiNlOWJkNzA7LS1pbms6I2Y1ZjRlZn0qe2JveC1zaXppbmc6Ym9yZGVyLWJveH1ib2R5e21hcmdpbjowO2JhY2tncm91bmQ6dmFyKC0tYmcpO2NvbG9yOnZhcigtLWluayk7Zm9udDoxNXB4IHN5c3RlbS11aSxzYW5zLXNlcmlmfWJ1dHRvbixpbnB1dCx0ZXh0YXJlYSxzZWxlY3R7Zm9udDppbmhlcml0fWJ1dHRvbntjdXJzb3I6cG9pbnRlcjtiYWNrZ3JvdW5kOiMyNDJiMzQ7Y29sb3I6dmFyKC0taW5rKTtib3JkZXI6MXB4IHNvbGlkICMzYTQyNGU7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMXB4IDE2cHh9YnV0dG9uOmhvdmVye2JvcmRlci1jb2xvcjp2YXIoLS1nb2xkKX1idXR0b246Zm9jdXMtdmlzaWJsZSxhOmZvY3VzLXZpc2libGV7b3V0bGluZTozcHggc29saWQgdmFyKC0tZ29sZCk7b3V0bGluZS1vZmZzZXQ6M3B4fS5wcmltYXJ5e2JhY2tncm91bmQ6dmFyKC0tZ29sZCk7Y29sb3I6IzE0MTQxNDtib3JkZXItY29sb3I6dmFyKC0tZ29sZCk7Zm9udC13ZWlnaHQ6NzUwfWhlYWRlcntib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1saW5lKTtwYWRkaW5nOjIycHggNCU7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtnYXA6MTVweH0uYnJhbmR7Zm9udC1zaXplOjE5cHg7Zm9udC13ZWlnaHQ6ODUwO2xldHRlci1zcGFjaW5nOjNweH0uYnJhbmQgYntkaXNwbGF5OmlubGluZS1ncmlkO3BsYWNlLWl0ZW1zOmNlbnRlcjt3aWR0aDozM3B4O2hlaWdodDozM3B4O2JhY2tncm91bmQ6dmFyKC0tZ29sZCk7Y29sb3I6IzE0MTQxNDtib3JkZXItcmFkaXVzOjZweDttYXJnaW4tcmlnaHQ6MTBweDtsZXR0ZXItc3BhY2luZzowfS50YWd7Zm9udC1zaXplOjExcHg7Y29sb3I6dmFyKC0tZ29sZCk7bGV0dGVyLXNwYWNpbmc6MnB4fS5zaGVsbHttYXgtd2lkdGg6MTQ0MHB4O21hcmdpbjphdXRvO3BhZGRpbmc6MzVweCA0JX1oMXtmb250LXNpemU6Y2xhbXAoMzBweCw0dncsNDlweCk7bGV0dGVyLXNwYWNpbmc6LTJweDttYXJnaW46MTBweCAwfWgye2ZvbnQtc2l6ZToyMHB4O21hcmdpbi10b3A6MH1oM3tmb250LXNpemU6MTdweH1we2xpbmUtaGVpZ2h0OjEuNn0ubXV0ZWQsc21hbGx7Y29sb3I6dmFyKC0tbXV0ZWQpfS5pbnRyb3tkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoyMHB4O21hcmdpbi1ib3R0b206MjZweH0udGFic3tkaXNwbGF5OmZsZXg7Z2FwOjhweDttYXJnaW4tYm90dG9tOjI1cHg7b3ZlcmZsb3c6YXV0b30udGFicyBidXR0b257d2hpdGUtc3BhY2U6bm93cmFwO2JhY2tncm91bmQ6dHJhbnNwYXJlbnQ7Ym9yZGVyLWNvbG9yOnRyYW5zcGFyZW50fS50YWJzIGJ1dHRvblthcmlhLXNlbGVjdGVkPXRydWVde2JhY2tncm91bmQ6IzI4MjUxZjtjb2xvcjp2YXIoLS1nb2xkKTtib3JkZXItY29sb3I6IzY1NTMzNX0uZ3JpZHtkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAxLjA1ZnI7Z2FwOjI0cHh9LmNhcmR7YmFja2dyb3VuZDp2YXIoLS1wYW5lbCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtib3JkZXItcmFkaXVzOjE0cHg7cGFkZGluZzoyNHB4O21hcmdpbi1ib3R0b206MjBweH0ucm93e2Rpc3BsYXk6ZmxleDtnYXA6MTJweDthbGlnbi1pdGVtczpjZW50ZXI7ZmxleC13cmFwOndyYXB9LnJvdz4qe2ZsZXg6MX0uYWN0aW9ucz4qe2ZsZXg6aW5pdGlhbH1sYWJlbHtkaXNwbGF5OmJsb2NrO2ZvbnQtc2l6ZToxMnB4O2xldHRlci1zcGFjaW5nOi4zcHg7Y29sb3I6dmFyKC0tbXV0ZWQpO21hcmdpbi1ib3R0b206MTZweH1pbnB1dCx0ZXh0YXJlYSxzZWxlY3R7ZGlzcGxheTpibG9jazt3aWR0aDoxMDAlO2JhY2tncm91bmQ6IzBlMTIxNztib3JkZXI6MXB4IHNvbGlkICMzOTQyNGQ7Ym9yZGVyLXJhZGl1czo3cHg7cGFkZGluZzoxMnB4O2NvbG9yOnZhcigtLWluayk7bWFyZ2luLXRvcDo3cHh9aW5wdXQ6Zm9jdXMsdGV4dGFyZWE6Zm9jdXMsc2VsZWN0OmZvY3Vze291dGxpbmU6MnB4IHNvbGlkIHZhcigtLWdvbGQpO291dGxpbmUtb2Zmc2V0OjFweH10ZXh0YXJlYXttaW4taGVpZ2h0Ojk0cHg7cmVzaXplOnZlcnRpY2FsfS5leWVicm93e2ZvbnQtc2l6ZToxMXB4O2xldHRlci1zcGFjaW5nOjJweDtjb2xvcjp2YXIoLS1nb2xkKTt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2V9LmNyZWF0aXZle21pbi1oZWlnaHQ6NDIwcHg7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtiYWNrZ3JvdW5kOnJhZGlhbC1ncmFkaWVudChlbGxpcHNlIGF0IDkwJSAwJSwjNTE0MTI4IDAsdHJhbnNwYXJlbnQgNjUlKSwjMTAxNTFiO3BhZGRpbmc6MzZweDtib3JkZXI6MXB4IHNvbGlkICM2YTU3MzY7Ym9yZGVyLXJhZGl1czoxMHB4O292ZXJmbG93OmhpZGRlbn0uY3JlYXRpdmUgaDJ7Zm9udC1zaXplOmNsYW1wKDI5cHgsMy4ydncsNDZweCk7bGV0dGVyLXNwYWNpbmc6LTEuNHB4O2xpbmUtaGVpZ2h0OjEuMTtvdmVyZmxvdy13cmFwOmFueXdoZXJlO21hcmdpbjozMHB4IDAgMThweH0uY3JlYXRpdmUgcHtjb2xvcjojZDNkNmQ4O292ZXJmbG93LXdyYXA6YW55d2hlcmV9LmNyZWF0aXZlIC5jdGF7ZGlzcGxheTppbmxpbmUtYmxvY2s7YmFja2dyb3VuZDp2YXIoLS1nb2xkKTtjb2xvcjojMTAxMDEwO2ZvbnQtd2VpZ2h0Ojc1MDtwYWRkaW5nOjEycHggMThweDtib3JkZXItcmFkaXVzOjVweH0ucGlsbHtmb250LXNpemU6MTFweDtib3JkZXI6MXB4IHNvbGlkICM1MzUwNGE7cGFkZGluZzo2cHggOXB4O2JvcmRlci1yYWRpdXM6MjBweDtjb2xvcjp2YXIoLS1nb2xkKX0uc3RhdHN7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoNCwxZnIpO2dhcDoxNXB4O21hcmdpbi1ib3R0b206MjRweH0uc3RhdHtiYWNrZ3JvdW5kOnZhcigtLXBhbmVsKTtwYWRkaW5nOjIycHg7Ym9yZGVyLXJhZGl1czoxMnB4O2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSl9LnN0YXQgc3Ryb25ne2Rpc3BsYXk6YmxvY2s7Zm9udC1zaXplOjI4cHg7bWFyZ2luOjEycHggMCAwfS5oaW50e2ZvbnQtc2l6ZToxMnB4O2xpbmUtaGVpZ2h0OjEuNjtjb2xvcjp2YXIoLS1tdXRlZCl9W2hpZGRlbl17ZGlzcGxheTpub25lIWltcG9ydGFudH0ubm90aWNle3BhZGRpbmc6MTNweDtiYWNrZ3JvdW5kOiMyNDIyMTk7Ym9yZGVyOjFweCBzb2xpZCAjNTU0NTJjO2JvcmRlci1yYWRpdXM6OHB4O2NvbG9yOiNmMWQxOWI7Zm9udC1zaXplOjEzcHh9LnRhYmxld3JhcHtvdmVyZmxvdy14OmF1dG99dGFibGV7Ym9yZGVyLWNvbGxhcHNlOmNvbGxhcHNlO3dpZHRoOjEwMCU7bWluLXdpZHRoOjY1MHB4fXRoLHRke3RleHQtYWxpZ246bGVmdDtwYWRkaW5nOjE0cHggMTBweDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1saW5lKTtmb250LXNpemU6MTNweH10aHtjb2xvcjp2YXIoLS1tdXRlZCl9I3RvYXN0e3Bvc2l0aW9uOmZpeGVkO2JvdHRvbToyMHB4O2xlZnQ6NTAlO3RyYW5zZm9ybTp0cmFuc2xhdGVYKC01MCUpO2JhY2tncm91bmQ6I2U5YmQ3MDtjb2xvcjojMTAxMDEwO3BhZGRpbmc6MTJweCAyMHB4O2JvcmRlci1yYWRpdXM6OHB4O3otaW5kZXg6NTttYXgtd2lkdGg6OTB2d30ubGlicmFyeS1pdGVte2Rpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjIwcHg7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tbGluZSk7cGFkZGluZzoxNXB4IDB9LmVtcHR5e3BhZGRpbmc6MzBweDt0ZXh0LWFsaWduOmNlbnRlcjtjb2xvcjp2YXIoLS1tdXRlZCl9Zm9vdGVye21hcmdpbi10b3A6MzBweDtmb250LXNpemU6MTJweDtjb2xvcjp2YXIoLS1tdXRlZCk7bGluZS1oZWlnaHQ6MS44fS5icmllZnt3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjd9LmRhbmdlcntjb2xvcjojZmZhNmE2fUBtZWRpYShtYXgtd2lkdGg6ODAwcHgpey5ncmlke2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnJ9LnN0YXRze2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMWZyfS5pbnRyb3tkaXNwbGF5OmJsb2NrfS5pbnRybyAucm93e21hcmdpbi10b3A6MjBweH0uc2hlbGx7cGFkZGluZzoyNXB4IDUlfWhlYWRlcntwYWRkaW5nOjE2cHggNSV9LmNhcmR7cGFkZGluZzoxOXB4fS5jcmVhdGl2ZXttaW4taGVpZ2h0OjM2MHB4O3BhZGRpbmc6MjdweH0uYnJhbmR7Zm9udC1zaXplOjE1cHh9LnRhZ3tkaXNwbGF5Om5vbmV9fQo8L3N0eWxlPjwvaGVhZD48Ym9keT4KPGhlYWRlcj48ZGl2IGNsYXNzPSJicmFuZCI+PGI+SDwvYj5IRVJDVUxFUyA8c3BhbiBjbGFzcz0ibXV0ZWQiPi8gQUQgU1RVRElPPC9zcGFuPjwvZGl2PjxzcGFuIGNsYXNzPSJ0YWciPlNBVUNFQVBQUk9WRUQgwrcgRk9VTkRFUiBFRElUSU9OPC9zcGFuPjwvaGVhZGVyPgo8bWFpbiBjbGFzcz0ic2hlbGwiPjxkaXYgY2xhc3M9ImludHJvIj48ZGl2PjxkaXYgY2xhc3M9ImV5ZWJyb3ciPllvdXIgb2ZmZXIuIFlvdXIgdm9pY2UuIFlvdXIgZ3Jvd3RoLjwvZGl2PjxoMT5NYWtlIHRoZSBuZXh0IG1vdmUgY291bnQuPC9oMT48cCBjbGFzcz0ibXV0ZWQiPkJ1aWxkIHRoZSBtZXNzYWdlLiBTaGFwZSB0aGUgY3JlYXRpdmUuIE1lYXN1cmUgdGhlIHJlc3VsdC48L3A+PC9kaXY+PGRpdiBjbGFzcz0icm93IGFjdGlvbnMiPjxidXR0b24gaWQ9ImJhY2t1cCI+RXhwb3J0IHdvcmtzcGFjZTwvYnV0dG9uPjxidXR0b24gaWQ9InNhdmUiIGNsYXNzPSJwcmltYXJ5Ij5TYXZlIGNhbXBhaWduPC9idXR0b24+PC9kaXY+PC9kaXY+CjxuYXYgY2xhc3M9InRhYnMiIGFyaWEtbGFiZWw9IlN0dWRpbyBzZWN0aW9ucyIgcm9sZT0idGFibGlzdCI+PGJ1dHRvbiByb2xlPSJ0YWIiIGFyaWEtc2VsZWN0ZWQ9InRydWUiIGRhdGEtdGFiPSJjcmVhdGUiPjAxIMK3IENyZWF0ZTwvYnV0dG9uPjxidXR0b24gcm9sZT0idGFiIiBhcmlhLXNlbGVjdGVkPSJmYWxzZSIgZGF0YS10YWI9InBsYW4iPjAyIMK3IFBsYW48L2J1dHRvbj48YnV0dG9uIHJvbGU9InRhYiIgYXJpYS1zZWxlY3RlZD0iZmFsc2UiIGRhdGEtdGFiPSJyZXN1bHRzIj4wMyDCtyBSZXN1bHRzPC9idXR0b24+PGJ1dHRvbiByb2xlPSJ0YWIiIGFyaWEtc2VsZWN0ZWQ9ImZhbHNlIiBkYXRhLXRhYj0ibGlicmFyeSI+MDQgwrcgQ2FtcGFpZ25zPC9idXR0b24+PC9uYXY+CjxzZWN0aW9uIGlkPSJjcmVhdGUiPjxkaXYgY2xhc3M9ImdyaWQiPjxkaXY+PGZvcm0gaWQ9Im9mZmVyIiBjbGFzcz0iY2FyZCI+PGgyPlN0YXJ0IHdpdGggdGhlIG9mZmVyPC9oMj48bGFiZWw+Q2FtcGFpZ24gbmFtZTxpbnB1dCBpZD0ibmFtZSIgbWF4bGVuZ3RoPSIxMDAiIHJlcXVpcmVkIHZhbHVlPSJIZXJjdWxlcyDCtyBGb3VuZGluZyBwaWxvdCI+PC9sYWJlbD48ZGl2IGNsYXNzPSJyb3ciPjxsYWJlbD5CcmFuZDxpbnB1dCBpZD0iYnJhbmQiIG1heGxlbmd0aD0iNjAiIHJlcXVpcmVkIHZhbHVlPSJIZXJjdWxlcyI+PC9sYWJlbD48bGFiZWw+Q2hhbm5lbDxzZWxlY3QgaWQ9ImNoYW5uZWwiPjxvcHRpb24+TWV0YTwvb3B0aW9uPjxvcHRpb24+R29vZ2xlPC9vcHRpb24+PG9wdGlvbj5MaW5rZWRJbjwvb3B0aW9uPjxvcHRpb24+VGlrVG9rPC9vcHRpb24+PG9wdGlvbj5PcmdhbmljPC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD48L2Rpdj48bGFiZWw+V2hhdCBhcmUgeW91IG9mZmVyaW5nPzxpbnB1dCBpZD0icHJvZHVjdCIgbWF4bGVuZ3RoPSIxMjAiIHJlcXVpcmVkIHZhbHVlPSJSZXZlbnVlIFJlY292ZXJ5IGZvdW5kaW5nIHBpbG90Ij48L2xhYmVsPjxsYWJlbD5XaG8gaXMgaXQgZm9yPzxpbnB1dCBpZD0iYXVkaWVuY2UiIG1heGxlbmd0aD0iMTQwIiByZXF1aXJlZCB2YWx1ZT0iVS5TLiBCMkIgc2VydmljZSBidXNpbmVzcyBvd25lcnMiPjwvbGFiZWw+PGxhYmVsPlByb2JsZW0gdG8gYWRkcmVzczxpbnB1dCBpZD0icHJvYmxlbSIgbWF4bGVuZ3RoPSIxNTAiIHJlcXVpcmVkIHZhbHVlPSJVbnBhaWQgaW52b2ljZXMgYW5kIHNjYXR0ZXJlZCBmb2xsb3ctdXAiPjwvbGFiZWw+PGxhYmVsPkJlbmVmaXQgdG8gZXhwbG9yZTxpbnB1dCBpZD0iYmVuZWZpdCIgbWF4bGVuZ3RoPSIxNTAiIHJlcXVpcmVkIHZhbHVlPSJCcmluZyByZWNlaXZhYmxlcyBhbmQgZm9sbG93LXVwIGludG8gb25lIGNvbnRyb2xsZWQgd29ya2Zsb3ciPjwvbGFiZWw+PGxhYmVsPkV2aWRlbmNlIG9yIGRlbW9uc3RyYXRpb24gYXZhaWxhYmxlPHRleHRhcmVhIGlkPSJwcm9vZiIgbWF4bGVuZ3RoPSIzMDAiPkV4cGxvcmUgYSBzeW50aGV0aWMgaW52b2ljZSBkZW1vIHdpdGggdmlzaWJsZSBhY3Rpb24gcmVjb3Jkcy48L3RleHRhcmVhPjwvbGFiZWw+PGRpdiBjbGFzcz0icm93Ij48bGFiZWw+Q2FsbCB0byBhY3Rpb248c2VsZWN0IGlkPSJjdGEiPjxvcHRpb24+UmVxdWVzdCBhIHBpbG90PC9vcHRpb24+PG9wdGlvbj5FeHBsb3JlIHRoZSBkZW1vPC9vcHRpb24+PG9wdGlvbj5MZWFybiBtb3JlPC9vcHRpb24+PG9wdGlvbj5TaG9wIG5vdzwvb3B0aW9uPjxvcHRpb24+Qm9vayBhIGNhbGw8L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPjxsYWJlbD5Wb2ljZTxzZWxlY3QgaWQ9InZvaWNlIj48b3B0aW9uPkRpcmVjdDwvb3B0aW9uPjxvcHRpb24+Q29uZmlkZW50PC9vcHRpb24+PG9wdGlvbj5Db252ZXJzYXRpb25hbDwvb3B0aW9uPjwvc2VsZWN0PjwvbGFiZWw+PC9kaXY+PGxhYmVsPkxhbmRpbmcgcGFnZSBVUkw8aW5wdXQgaWQ9InVybCIgdHlwZT0idXJsIiBtYXhsZW5ndGg9IjIwMDAiIHBsYWNlaG9sZGVyPSJodHRwczovL3lvdXItdmVyaWZpZWQtbGFuZGluZy1wYWdlLmNvbSI+PC9sYWJlbD48YnV0dG9uIGNsYXNzPSJwcmltYXJ5IiB0eXBlPSJzdWJtaXQiPkJ1aWxkIDMgYWQgdmFyaWF0aW9ucyDihpc8L2J1dHRvbj48cCBjbGFzcz0iaGludCI+T3JpZ2luYWwgdGVtcGxhdGUtYmFzZWQgY29weS4gUmV2aWV3IGNsYWltcyBhZ2FpbnN0IHlvdXIgYWN0dWFsIG9mZmVyIGJlZm9yZSB1c2UuPC9wPjwvZm9ybT48L2Rpdj48ZGl2PjxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9InJvdyI+PGgyPkNyZWF0aXZlIGRlc2s8L2gyPjxzcGFuIGNsYXNzPSJwaWxsIj5EUkFGVCDCtyBOT1QgUFVCTElTSEVEPC9zcGFuPjwvZGl2PjxsYWJlbD5NZXNzYWdpbmcgYW5nbGU8c2VsZWN0IGlkPSJhbmdsZSI+PC9zZWxlY3Q+PC9sYWJlbD48ZGl2IGNsYXNzPSJjcmVhdGl2ZSIgaWQ9InByZXZpZXciPjxkaXYgY2xhc3M9ImV5ZWJyb3ciIGlkPSJwcmV2aWV3QnJhbmQiPjwvZGl2PjxkaXY+PGgyIGlkPSJwcmV2aWV3SGVhZGxpbmUiPjwvaDI+PHAgaWQ9InByZXZpZXdCb2R5Ij48L3A+PC9kaXY+PGRpdj48c3BhbiBjbGFzcz0iY3RhIiBpZD0icHJldmlld0N0YSI+PC9zcGFuPjxwIGNsYXNzPSJoaW50Ij5IRVJDVUxFUyBBRCBTVFVESU8gLyBDUkVBVElWRSBDT05DRVBUPC9wPjwvZGl2PjwvZGl2PjxwIGNsYXNzPSJoaW50Ij5Db25jZXB0IHByZXZpZXcsIG5vdCBhbiBleGFjdCBwbGF0Zm9ybSBwbGFjZW1lbnQuIFBORyBleHBvcnRzIGF0IDEwODAgw5cgMTA4MC48L3A+PGxhYmVsPkhlYWRsaW5lPGlucHV0IGlkPSJoZWFkbGluZSIgbWF4bGVuZ3RoPSIxMjAiPjwvbGFiZWw+PGxhYmVsPlByaW1hcnkgdGV4dDx0ZXh0YXJlYSBpZD0iYm9keSIgbWF4bGVuZ3RoPSI2MDAiPjwvdGV4dGFyZWE+PC9sYWJlbD48ZGl2IGNsYXNzPSJyb3cgYWN0aW9ucyI+PGJ1dHRvbiBpZD0icG5nIj5Eb3dubG9hZCBQTkc8L2J1dHRvbj48YnV0dG9uIGlkPSJjb3B5Ij5Db3B5IGFkIHRleHQ8L2J1dHRvbj48YnV0dG9uIGlkPSJjYW1wYWlnbkV4cG9ydCI+RXhwb3J0IGNhbXBhaWduPC9idXR0b24+PC9kaXY+PC9kaXY+PGRpdiBjbGFzcz0iY2FyZCI+PGgyPkNyZWF0aXZlIGJyaWVmPC9oMj48ZGl2IGNsYXNzPSJicmllZiBtdXRlZCIgaWQ9ImJyaWVmIj48L2Rpdj48L2Rpdj48L2Rpdj48L2Rpdj48L3NlY3Rpb24+CjxzZWN0aW9uIGlkPSJwbGFuIiBoaWRkZW4+PGRpdiBjbGFzcz0iZ3JpZCI+PGRpdiBjbGFzcz0iY2FyZCI+PGgyPlNldCBhIHRlc3QgZW52ZWxvcGU8L2gyPjxwIGNsYXNzPSJtdXRlZCI+UGxhbm5pbmcgYXJpdGhtZXRpYyBvbmx5LiBUaGVzZSB2YWx1ZXMgZG8gbm90IGNyZWF0ZSBhIGNhbXBhaWduIG9yIHByZWRpY3QgcGVyZm9ybWFuY2UuPC9wPjxkaXYgY2xhc3M9InJvdyI+PGxhYmVsPlRvdGFsIHRlc3QgYnVkZ2V0ICgkKTxpbnB1dCBpZD0iYnVkZ2V0IiB0eXBlPSJudW1iZXIiIG1pbj0iMCIgbWF4PSIxMDAwMDAwIiBzdGVwPSIwLjAxIiB2YWx1ZT0iMTUwIj48L2xhYmVsPjxsYWJlbD5UZXN0IGR1cmF0aW9uIChkYXlzKTxpbnB1dCBpZD0iZGF5cyIgdHlwZT0ibnVtYmVyIiBtaW49IjEiIG1heD0iMzY1IiBzdGVwPSIxIiB2YWx1ZT0iNyI+PC9sYWJlbD48L2Rpdj48bGFiZWw+TnVtYmVyIG9mIGNyZWF0aXZlIHZhcmlhdGlvbnM8aW5wdXQgaWQ9InZhcmlhbnRzIiB0eXBlPSJudW1iZXIiIG1pbj0iMSIgbWF4PSIxMDAiIHN0ZXA9IjEiIHZhbHVlPSIzIj48L2xhYmVsPjxkaXYgaWQ9InBsYW5OdW1iZXJzIiBjbGFzcz0ibm90aWNlIj48L2Rpdj48cCBjbGFzcz0iaGludCI+RXF1YWwgYWxsb2NhdGlvbiBpcyBhIHBsYW5uaW5nIGNob2ljZSwgbm90IGFuIGluc3RydWN0aW9uIHRvIHBsYXRmb3JtIGRlbGl2ZXJ5IHN5c3RlbXMuIENvbXBhcmUgb25lIG1lYW5pbmdmdWwgdmFyaWFibGUgYXQgYSB0aW1lLjwvcD48aDM+UmV2aWV3IGJlZm9yZSB1c2luZyBhZHM8L2gzPjxwIGNsYXNzPSJtdXRlZCI+Q2hlY2sgdGhlIG9mZmVyIGFuZCBwcm9vZiwgb3BlbiB5b3VyIGxhbmRpbmcgcGFnZSwgY29uZmlybSBpdHMgY29udGFjdCBmb3JtIHdvcmtzLCBhbmQgdmVyaWZ5IGNvbnZlcnNpb24gdHJhY2tpbmcgaW4gdGhlIHBsYXRmb3JtIHdoZXJlIHlvdSBsYXVuY2guPC9wPjwvZGl2PjxkaXYgY2xhc3M9ImNhcmQiPjxoMj5DYW1wYWlnbiB0cmFja2luZyBsaW5rPC9oMj48bGFiZWw+VVRNIHNvdXJjZTxpbnB1dCBpZD0ic291cmNlIiBtYXhsZW5ndGg9IjgwIiB2YWx1ZT0ibWV0YSI+PC9sYWJlbD48bGFiZWw+VVRNIG1lZGl1bTxpbnB1dCBpZD0ibWVkaXVtIiBtYXhsZW5ndGg9IjgwIiB2YWx1ZT0icGFpZF9zb2NpYWwiPjwvbGFiZWw+PGxhYmVsPlVUTSBjYW1wYWlnbjxpbnB1dCBpZD0idXRtQ2FtcGFpZ24iIG1heGxlbmd0aD0iMTAwIiB2YWx1ZT0iaGVyY3VsZXNfZm91bmRpbmdfcGlsb3QiPjwvbGFiZWw+PGxhYmVsPlVUTSBjb250ZW50PGlucHV0IGlkPSJjb250ZW50IiBtYXhsZW5ndGg9IjgwIiB2YWx1ZT0icHJvYmxlbV9hbmdsZSI+PC9sYWJlbD48bGFiZWw+R2VuZXJhdGVkIGxpbms8dGV4dGFyZWEgaWQ9InRyYWNraW5nIiByZWFkb25seT48L3RleHRhcmVhPjwvbGFiZWw+PGJ1dHRvbiBpZD0iY29weUxpbmsiPkNvcHkgdHJhY2tpbmcgbGluazwvYnV0dG9uPjxwIGNsYXNzPSJoaW50Ij5TZXQgYSB2YWxpZCBIVFRQUyBsYW5kaW5nIHBhZ2UgaW4gQ3JlYXRlLiBFeGlzdGluZyBub24tVVRNIHBhcmFtZXRlcnMgYXJlIHByZXNlcnZlZC48L3A+PC9kaXY+PC9kaXY+PC9zZWN0aW9uPgo8c2VjdGlvbiBpZD0icmVzdWx0cyIgaGlkZGVuPjxkaXYgY2xhc3M9Im5vdGljZSIgc3R5bGU9Im1hcmdpbi1ib3R0b206MjJweCI+TWFudWFsIHJlc3VsdHMgwrcgRW50ZXIgYWN0dWFsIHBsYXRmb3JtIGRhdGEuIE5vIGFkIGFjY291bnRzIGFyZSBjb25uZWN0ZWQuPC9kaXY+PGRpdiBjbGFzcz0ic3RhdHMiIGlkPSJzdGF0cyI+PC9kaXY+PGRpdiBjbGFzcz0iY2FyZCI+PGgyPlJlY29yZCBhIHJlc3VsdDwvaDI+PGZvcm0gaWQ9InJlc3VsdEZvcm0iPjxkaXYgY2xhc3M9InJvdyI+PGxhYmVsPkNyZWF0aXZlIC8gZXhwZXJpbWVudDxpbnB1dCBpZD0icmVzdWx0TmFtZSIgcmVxdWlyZWQgbWF4bGVuZ3RoPSIxMDAiIHBsYWNlaG9sZGVyPSJQcm9ibGVtIGFuZ2xlIMK3IHdlZWsgMSI+PC9sYWJlbD48bGFiZWw+U3BlbmQgKCQpPGlucHV0IGlkPSJzcGVuZCIgcmVxdWlyZWQgdHlwZT0ibnVtYmVyIiBtaW49IjAiIG1heD0iMTAwMDAwMDAwMCIgc3RlcD0iMC4wMSIgdmFsdWU9IjAiPjwvbGFiZWw+PGxhYmVsPkltcHJlc3Npb25zPGlucHV0IGlkPSJpbXByZXNzaW9ucyIgcmVxdWlyZWQgdHlwZT0ibnVtYmVyIiBtaW49IjAiIG1heD0iMTAwMDAwMDAwMCIgc3RlcD0iMSIgdmFsdWU9IjAiPjwvbGFiZWw+PC9kaXY+PGRpdiBjbGFzcz0icm93Ij48bGFiZWw+Q2xpY2tzPGlucHV0IGlkPSJjbGlja3MiIHJlcXVpcmVkIHR5cGU9Im51bWJlciIgbWluPSIwIiBtYXg9IjEwMDAwMDAwMDAiIHN0ZXA9IjEiIHZhbHVlPSIwIj48L2xhYmVsPjxsYWJlbD5Db252ZXJzaW9uczxpbnB1dCBpZD0iY29udmVyc2lvbnMiIHJlcXVpcmVkIHR5cGU9Im51bWJlciIgbWluPSIwIiBtYXg9IjEwMDAwMDAwMDAiIHN0ZXA9IjEiIHZhbHVlPSIwIj48L2xhYmVsPjxsYWJlbD5BdHRyaWJ1dGVkIHJldmVudWUgKCQpPGlucHV0IGlkPSJyZXZlbnVlIiByZXF1aXJlZCB0eXBlPSJudW1iZXIiIG1pbj0iMCIgbWF4PSIxMDAwMDAwMDAwIiBzdGVwPSIwLjAxIiB2YWx1ZT0iMCI+PC9sYWJlbD48L2Rpdj48YnV0dG9uIHR5cGU9InN1Ym1pdCIgY2xhc3M9InByaW1hcnkiPkFkZCByZXN1bHQ8L2J1dHRvbj48L2Zvcm0+PC9kaXY+PGRpdiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0icm93IGFjdGlvbnMiPjxoMj5FeHBlcmltZW50IGxlZGdlcjwvaDI+PGJ1dHRvbiBpZD0iY3N2Ij5FeHBvcnQgQ1NWPC9idXR0b24+PC9kaXY+PGRpdiBjbGFzcz0idGFibGV3cmFwIj48dGFibGU+PHRoZWFkPjx0cj48dGg+Q3JlYXRpdmU8L3RoPjx0aD5TcGVuZDwvdGg+PHRoPkNUUjwvdGg+PHRoPkNQQzwvdGg+PHRoPkNQQTwvdGg+PHRoPlJPQVM8L3RoPjx0aD5BY3Rpb248L3RoPjwvdHI+PC90aGVhZD48dGJvZHkgaWQ9ImxlZGdlciI+PC90Ym9keT48L3RhYmxlPjwvZGl2PjxwIGNsYXNzPSJoaW50Ij5ST0FTIGlzIGF0dHJpYnV0ZWQgcmV2ZW51ZSDDtyBzcGVuZCwgbm90IHByb2ZpdC4gQXR0cmlidXRpb24gYW5kIGRhdGEgcXVhbGl0eSBkZXBlbmQgb24gdGhlIGZpZ3VyZXMgeW91IGVudGVyLiBObyBhdXRvbWF0aWMgd2lubmVyIGNsYWltcy48L3A+PC9kaXY+PC9zZWN0aW9uPgo8c2VjdGlvbiBpZD0ibGlicmFyeSIgaGlkZGVuPjxkaXYgY2xhc3M9ImNhcmQiPjxoMj5Zb3VyIGNhbXBhaWduczwvaDI+PHAgY2xhc3M9Im11dGVkIj5TYXZlZCBvbiB0aGlzIGJyb3dzZXIgYW5kIGRldmljZS4gRXhwb3J0IGEgYmFja3VwIGJlZm9yZSBzd2l0Y2hpbmcgZGV2aWNlcy48L3A+PGRpdiBpZD0iY2FtcGFpZ25zIj48L2Rpdj48ZGl2IGNsYXNzPSJyb3cgYWN0aW9ucyIgc3R5bGU9Im1hcmdpbi10b3A6MjBweCI+PGJ1dHRvbiBpZD0ibmV3Ij5OZXcgY2FtcGFpZ248L2J1dHRvbj48YnV0dG9uIGlkPSJyZXN0b3JlIj5JbXBvcnQgd29ya3NwYWNlIGJhY2t1cDwvYnV0dG9uPjxpbnB1dCB0eXBlPSJmaWxlIiBhY2NlcHQ9ImFwcGxpY2F0aW9uL2pzb24sLmpzb24iIGlkPSJyZXN0b3JlRmlsZSIgaGlkZGVuPjwvZGl2PjwvZGl2Pjwvc2VjdGlvbj4KPGZvb3Rlcj5IZXJjdWxlcyBBZCBTdHVkaW8gdjEuMCDCtyBPcmlnaW5hbCBIZXJjdWxlcyBjb2RlIMK3IE5vIGV4dGVybmFsIHNjcmlwdHMgb3IgbmV0d29yayBjYWxscy48YnI+V29ya3NwYWNlIGRhdGEgc3RheXMgaW4gYnJvd3NlciBzdG9yYWdlLiBUaGlzIGVkaXRpb24gcHJlcGFyZXMgYXNzZXRzIGFuZCByZWNvcmRzIG1hbnVhbCByZXN1bHRzOyBpdCBkb2VzIG5vdCBwdWJsaXNoIGFkcyBvciBzcGVuZCBtb25leS48L2Zvb3Rlcj48L21haW4+PGRpdiBpZD0idG9hc3QiIHJvbGU9InN0YXR1cyIgaGlkZGVuPjwvZGl2Pgo8c2NyaXB0IGlkPSJjb3JlIj4KY29uc3QgU3R1ZGlvID0gKCgpPT57CiBjb25zdCBmaWVsZHM9WyduYW1lJywnYnJhbmQnLCdjaGFubmVsJywncHJvZHVjdCcsJ2F1ZGllbmNlJywncHJvYmxlbScsJ2JlbmVmaXQnLCdwcm9vZicsJ2N0YScsJ3ZvaWNlJywndXJsJ107CiBjb25zdCB0ZXh0PSh2LG49NjAwKT0+dHlwZW9mIHY9PT0nc3RyaW5nJz92LnNsaWNlKDAsbik6Jyc7CiBmdW5jdGlvbiBnZW5lcmF0ZShmKXtjb25zdCBpbnRybz1mLnZvaWNlPT09J0NvbnZlcnNhdGlvbmFsJz8iTGV0J3MgdGFsayBhYm91dCAiOmYudm9pY2U9PT0nQ29uZmlkZW50Jz8nVGFrZSBjb250cm9sIG9mICc6Jyc7cmV0dXJuIFsKIHthbmdsZTonUHJvYmxlbSDihpIgbmV4dCBzdGVwJyxoZWFkbGluZTpgJHtpbnRyb30ke2YucHJvYmxlbX1gLGJvZHk6YEZvciAke2YuYXVkaWVuY2V9OiAke2YuYmVuZWZpdH0uIEV4cGxvcmUgJHtmLnByb2R1Y3R9LiAke2YucHJvb2Z9YC50cmltKCl9LAoge2FuZ2xlOidPZmZlciDihpIgYmVuZWZpdCcsaGVhZGxpbmU6YE1lZXQgJHtmLmJyYW5kfWAsYm9keTpgJHtmLnByb2R1Y3R9IGZvciAke2YuYXVkaWVuY2V9LiAke2YuYmVuZWZpdH0uICR7Zi5wcm9vZn1gLnRyaW0oKX0sCiB7YW5nbGU6J1Byb29mIOKGkiBpbnZpdGF0aW9uJyxoZWFkbGluZTonU2VlIHRoZSB3b3JrZmxvdyBmb3IgeW91cnNlbGYuJyxib2R5OmAke2YucHJvb2Z9IEV4cGxvcmUgJHtmLnByb2R1Y3R9IGZyb20gJHtmLmJyYW5kfS4gJHtmLmN0YX0uYC50cmltKCl9XS5tYXAoYT0+KHsuLi5hLGhlYWRsaW5lOmEuaGVhZGxpbmUuc2xpY2UoMCwxMjApLGJvZHk6YS5ib2R5LnNsaWNlKDAsNjAwKX0pKTt9CiBmdW5jdGlvbiBudW0odixpbnRlZ2VyPWZhbHNlKXtjb25zdCBuPU51bWJlcih2KTtpZighTnVtYmVyLmlzRmluaXRlKG4pfHxuPDB8fG4+MWU5fHwoaW50ZWdlciYmIU51bWJlci5pc0ludGVnZXIobikpKXRocm93IEVycm9yKCdVc2UgdmFsaWQsIG5vbi1uZWdhdGl2ZSBudW1iZXJzLiBDb3VudHMgbXVzdCBiZSB3aG9sZSBudW1iZXJzLicpO3JldHVybiBuO30KIGZ1bmN0aW9uIG1ldHJpY3Mocil7Y29uc3Qgc3BlbmQ9bnVtKHIuc3BlbmQpLGltcHJlc3Npb25zPW51bShyLmltcHJlc3Npb25zLHRydWUpLGNsaWNrcz1udW0oci5jbGlja3MsdHJ1ZSksY29udmVyc2lvbnM9bnVtKHIuY29udmVyc2lvbnMsdHJ1ZSkscmV2ZW51ZT1udW0oci5yZXZlbnVlKTtyZXR1cm4ge3NwZW5kLGltcHJlc3Npb25zLGNsaWNrcyxjb252ZXJzaW9ucyxyZXZlbnVlLGN0cjppbXByZXNzaW9ucz9jbGlja3MvaW1wcmVzc2lvbnMqMTAwOm51bGwsY3BjOmNsaWNrcz9zcGVuZC9jbGlja3M6bnVsbCxjcGE6Y29udmVyc2lvbnM/c3BlbmQvY29udmVyc2lvbnM6bnVsbCxyb2FzOnNwZW5kP3JldmVudWUvc3BlbmQ6bnVsbH07fQogZnVuY3Rpb24gbGluayh1cmwscGFyYW1zKXtjb25zdCB1PW5ldyBVUkwodXJsKTtpZih1LnByb3RvY29sIT09J2h0dHBzOid8fHUudXNlcm5hbWV8fHUucGFzc3dvcmQpdGhyb3cgRXJyb3IoJ1VzZSBhbiBIVFRQUyBsYW5kaW5nIHBhZ2Ugd2l0aG91dCBlbWJlZGRlZCBjcmVkZW50aWFscy4nKTtmb3IoY29uc3QgW2ssdl0gb2YgT2JqZWN0LmVudHJpZXMocGFyYW1zKSl1LnNlYXJjaFBhcmFtcy5zZXQoJ3V0bV8nK2ssdGV4dCh2LDEwMCkpO3JldHVybiB1LmhyZWY7fQogZnVuY3Rpb24gYWxsb2NhdGlvbihiLGQsdil7Yj1udW0oYik7ZD1udW0oZCx0cnVlKTt2PW51bSh2LHRydWUpO2lmKGQ8MXx8djwxfHxkPjM2NXx8dj4xMDB8fGI+MWU2KXRocm93IEVycm9yKCdVc2UgMeKAkzM2NSBkYXlzLCAx4oCTMTAwIHZhcmlhdGlvbnMsIGFuZCBhIGJ1ZGdldCB1cCB0byAkMSwwMDAsMDAwLicpO3JldHVybiB7ZGFpbHk6Yi9kLHBlckNyZWF0aXZlOmIvdixwZXJDcmVhdGl2ZURhaWx5OmIvZC92fTt9CiBmdW5jdGlvbiBjc3Yocm93cyl7Y29uc3QgcXVvdGU9dj0+JyInK1N0cmluZyh0eXBlb2Ygdj09PSdzdHJpbmcnJiYvXls9K0BcLVx0XHJcbl0vLnRlc3Qodik/IiciK3Y6dikucmVwbGFjZUFsbCgnIicsJyIiJykrJyInO3JldHVybiByb3dzLm1hcChyb3c9PnJvdy5tYXAocXVvdGUpLmpvaW4oJywnKSkuam9pbignXHJcbicpO30KIGZ1bmN0aW9uIGNsZWFuQ2FtcGFpZ24oYyl7aWYoIWN8fHR5cGVvZiBjIT09J29iamVjdCd8fCFjLmZvcm18fCFBcnJheS5pc0FycmF5KGMuYWRzKXx8Yy5hZHMubGVuZ3RoIT09M3x8IUFycmF5LmlzQXJyYXkoYy5yZXN1bHRzKXx8Yy5yZXN1bHRzLmxlbmd0aD4xMDAwMCl0aHJvdyBFcnJvcignSW52YWxpZCBjYW1wYWlnbiBiYWNrdXAuJyk7Y29uc3QgZm9ybT1PYmplY3QuZnJvbUVudHJpZXMoZmllbGRzLm1hcChrPT5bayx0ZXh0KGMuZm9ybVtrXSxrPT09J3VybCc/MjAwMDo2MDApXSkpO2lmKCFmb3JtLm5hbWV8fCFmb3JtLmJyYW5kKXRocm93IEVycm9yKCdDYW1wYWlnbiBuYW1lIGFuZCBicmFuZCBhcmUgcmVxdWlyZWQuJyk7Y29uc3QgYWRzPWMuYWRzLm1hcChhPT4oe2FuZ2xlOnRleHQoYS5hbmdsZSw2MCksaGVhZGxpbmU6dGV4dChhLmhlYWRsaW5lLDEyMCksYm9keTp0ZXh0KGEuYm9keSw2MDApfSkpO2NvbnN0IHJlc3VsdHM9Yy5yZXN1bHRzLm1hcChyPT4oe2lkOnRleHQoci5pZCw4MCksbmFtZTp0ZXh0KHIubmFtZSwxMDApLC4uLm1ldHJpY3Mocil9KSk7Y29uc3QgcD1jLnBsYW58fHt9O2NvbnN0IHBsYW49e2J1ZGdldDpwLmJ1ZGdldD8/MTUwLGRheXM6cC5kYXlzPz83LHZhcmlhbnRzOnAudmFyaWFudHM/PzMsc291cmNlOnRleHQocC5zb3VyY2V8fCdtZXRhJyw4MCksbWVkaXVtOnRleHQocC5tZWRpdW18fCdwYWlkX3NvY2lhbCcsODApLHV0bUNhbXBhaWduOnRleHQocC51dG1DYW1wYWlnbnx8J2hlcmN1bGVzJywxMDApLGNvbnRlbnQ6dGV4dChwLmNvbnRlbnR8fCdwcm9ibGVtX2FuZ2xlJyw4MCl9O2FsbG9jYXRpb24ocGxhbi5idWRnZXQscGxhbi5kYXlzLHBsYW4udmFyaWFudHMpO3JldHVybiB7aWQ6dGV4dChjLmlkLDgwKSxmb3JtLGFkcyxyZXN1bHRzLHBsYW59O30KIGZ1bmN0aW9uIHJlc3RvcmUocmF3KXtpZighcmF3fHxyYXcuc2NoZW1hIT09J2hlcmN1bGVzLmFkLXN0dWRpby52MSd8fCFBcnJheS5pc0FycmF5KHJhdy5jYW1wYWlnbnMpfHxyYXcuY2FtcGFpZ25zLmxlbmd0aD4yMDApdGhyb3cgRXJyb3IoJ05vdCBhIHZhbGlkIEhlcmN1bGVzIEFkIFN0dWRpbyBiYWNrdXAuJyk7cmV0dXJuIHJhdy5jYW1wYWlnbnMubWFwKGNsZWFuQ2FtcGFpZ24pO30KIHJldHVybiB7ZmllbGRzLGdlbmVyYXRlLG1ldHJpY3MsbGluayxhbGxvY2F0aW9uLGNzdixyZXN0b3JlLGNsZWFuQ2FtcGFpZ259Owp9KSgpOwo8L3NjcmlwdD4KPHNjcmlwdD4KJ3VzZSBzdHJpY3QnOwpjb25zdCAkPWlkPT5kb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZCksIGtleT0naGVyY3VsZXMtYWQtc3R1ZGlvLXYxJywgcGxhbkZpZWxkcz1bJ2J1ZGdldCcsJ2RheXMnLCd2YXJpYW50cycsJ3NvdXJjZScsJ21lZGl1bScsJ3V0bUNhbXBhaWduJywnY29udGVudCddOwpsZXQgZGlydHk9ZmFsc2U7CmxldCBzYXZlZD1bXSxjdXJyZW50SWQ9Y3J5cHRvLnJhbmRvbVVVSUQoKSxhZHM9W10scmVzdWx0cz1bXSxzZWxlY3RlZD0wLHRpbWVyOwpjb25zdCBkZWZhdWx0cz1PYmplY3QuZnJvbUVudHJpZXMoU3R1ZGlvLmZpZWxkcy5tYXAoaz0+W2ssJChrKS52YWx1ZV0pKTsKZnVuY3Rpb24gdG9hc3Qocyl7JCgndG9hc3QnKS50ZXh0Q29udGVudD1zOyQoJ3RvYXN0JykuaGlkZGVuPWZhbHNlO2NsZWFyVGltZW91dCh0aW1lcik7dGltZXI9c2V0VGltZW91dCgoKT0+JCgndG9hc3QnKS5oaWRkZW49dHJ1ZSw1MDAwKTt9CmZ1bmN0aW9uIGZvcm0oKXtyZXR1cm4gT2JqZWN0LmZyb21FbnRyaWVzKFN0dWRpby5maWVsZHMubWFwKGs9PltrLCQoaykudmFsdWUudHJpbSgpXSkpO30KZnVuY3Rpb24gcGxhbigpe3JldHVybiBPYmplY3QuZnJvbUVudHJpZXMocGxhbkZpZWxkcy5tYXAoaz0+W2ssJChrKS52YWx1ZV0pKTt9CmZ1bmN0aW9uIHNuYXBzaG90KCl7cmV0dXJuIFN0dWRpby5jbGVhbkNhbXBhaWduKHtpZDpjdXJyZW50SWQsZm9ybTpmb3JtKCksYWRzLHJlc3VsdHMscGxhbjpwbGFuKCl9KTt9CmZ1bmN0aW9uIHBlcnNpc3QoKXt0cnl7bG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LEpTT04uc3RyaW5naWZ5KHtzY2hlbWE6J2hlcmN1bGVzLmFkLXN0dWRpby52MScsY2FtcGFpZ25zOnNhdmVkfSkpO3JldHVybiB0cnVlO31jYXRjaHt0b2FzdCgnQnJvd3NlciBzdG9yYWdlIGlzIHVuYXZhaWxhYmxlIG9yIGZ1bGwuIEV4cG9ydCB5b3VyIHdvcmtzcGFjZSBub3cuJyk7cmV0dXJuIGZhbHNlO319CmZ1bmN0aW9uIHNhdmUoKXtpZighJCgnb2ZmZXInKS5yZXBvcnRWYWxpZGl0eSgpKXJldHVybiBmYWxzZTt0cnl7Y29uc3QgYz1zbmFwc2hvdCgpO2NvbnN0IGk9c2F2ZWQuZmluZEluZGV4KHg9PnguaWQ9PT1jdXJyZW50SWQpO2lmKGk8MCl7aWYoc2F2ZWQubGVuZ3RoPj0yMDApdGhyb3cgRXJyb3IoJ1dvcmtzcGFjZSBsaW1pdDogMjAwIGNhbXBhaWducy4gRXhwb3J0IGEgYmFja3VwIGFuZCByZW1vdmUgb2xkIGNhbXBhaWducy4nKTtzYXZlZC5wdXNoKGMpO31lbHNlIHNhdmVkW2ldPWM7Y29uc3Qgb2s9cGVyc2lzdCgpO3JlbmRlckxpYnJhcnkoKTtpZihvayl7ZGlydHk9ZmFsc2U7dG9hc3QoJ0NhbXBhaWduIHNhdmVkIG9uIHRoaXMgZGV2aWNlLicpO31yZXR1cm4gdHJ1ZTt9Y2F0Y2goZSl7dG9hc3QoZS5tZXNzYWdlKTtyZXR1cm4gZmFsc2U7fX0KZnVuY3Rpb24gZG93bmxvYWQobmFtZSxkYXRhLHR5cGUpe2NvbnN0IGJsb2I9bmV3IEJsb2IoW2RhdGFdLHt0eXBlfSksdXJsPVVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYiksYT1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7YS5ocmVmPXVybDthLmRvd25sb2FkPW5hbWU7YS5jbGljaygpO3NldFRpbWVvdXQoKCk9PlVSTC5yZXZva2VPYmplY3RVUkwodXJsKSwxMDAwMCk7fQphc3luYyBmdW5jdGlvbiBjb3B5KHMpe3RyeXthd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChzKTt0b2FzdCgnQ29waWVkLicpO31jYXRjaHt0b2FzdCgnQ2xpcGJvYXJkIHVuYXZhaWxhYmxlLiBTZWxlY3QgdGhlIHRleHQgYW5kIGNvcHksIG9yIHVzZSBFeHBvcnQgY2FtcGFpZ24uJyk7fX0KZnVuY3Rpb24gcmVuZGVyUHJldmlldygpe2NvbnN0IGE9YWRzW3NlbGVjdGVkXTskKCdwcmV2aWV3QnJhbmQnKS50ZXh0Q29udGVudD0kKCdicmFuZCcpLnZhbHVlOyQoJ3ByZXZpZXdIZWFkbGluZScpLnRleHRDb250ZW50PWEuaGVhZGxpbmU7JCgncHJldmlld0JvZHknKS50ZXh0Q29udGVudD1hLmJvZHk7JCgncHJldmlld0N0YScpLnRleHRDb250ZW50PSQoJ2N0YScpLnZhbHVlOyQoJ2hlYWRsaW5lJykudmFsdWU9YS5oZWFkbGluZTskKCdib2R5JykudmFsdWU9YS5ib2R5OyQoJ2JyaWVmJykudGV4dENvbnRlbnQ9YEF1ZGllbmNlOiAkeyQoJ2F1ZGllbmNlJykudmFsdWV9XG5WaXN1YWw6IHNob3cgdGhlIGFjdHVhbCBwcm9kdWN0IHdvcmtmbG93LCB3aXRoIGEgY2xlYXIgaGVhZGxpbmUgYW5kIG9uZSBjYWxsIHRvIGFjdGlvbi5cbk9wZW5pbmc6IGludHJvZHVjZSB0aGUgcHJvYmxlbSBpbiB0aGUgZmlyc3Qgc2NlbmUuXG5NaWRkbGU6IGRlbW9uc3RyYXRlIG9uZSB1c2VmdWwgYWN0aW9uIHdpdGggc3ludGhldGljIGRhdGEuXG5DbG9zZTogJHskKCdjdGEnKS52YWx1ZX0uXG5FdmlkZW5jZTogJHskKCdwcm9vZicpLnZhbHVlIHx8ICdBZGQgdmVyaWZpZWQgZXZpZGVuY2UgYmVmb3JlIHVzaW5nIGNsYWltcy4nfVxuQ2hhbm5lbDogJHskKCdjaGFubmVsJykudmFsdWV9LiBDaGVjayBwbGFjZW1lbnQgcmVxdWlyZW1lbnRzIGJlZm9yZSB1cGxvYWQuYDt9CmZ1bmN0aW9uIHJlbmRlckFuZ2xlcygpeyAkKCdhbmdsZScpLnJlcGxhY2VDaGlsZHJlbiguLi5hZHMubWFwKChhLGkpPT5uZXcgT3B0aW9uKGEuYW5nbGUsU3RyaW5nKGkpKSkpOyQoJ2FuZ2xlJykudmFsdWU9U3RyaW5nKHNlbGVjdGVkKTtyZW5kZXJQcmV2aWV3KCk7fQokKCdvZmZlcicpLm9uc3VibWl0PWU9PntlLnByZXZlbnREZWZhdWx0KCk7aWYoYWRzLnNvbWUoYT0+YS5oZWFkbGluZSkmJiFjb25maXJtKCdSZXBsYWNlIHRoZSB0aHJlZSBjdXJyZW50IGFkIHZhcmlhdGlvbnMgd2l0aCBuZXcgZHJhZnRzPycpKXJldHVybjthZHM9U3R1ZGlvLmdlbmVyYXRlKGZvcm0oKSk7ZGlydHk9dHJ1ZTtzZWxlY3RlZD0wO3JlbmRlckFuZ2xlcygpO3RvYXN0KCdUaHJlZSBkcmFmdHMgY3JlYXRlZC4gUmV2aWV3IGFuZCBlZGl0IHRoZSBjb3B5LicpO307CiQoJ2FuZ2xlJykub25jaGFuZ2U9KCk9PntzZWxlY3RlZD1OdW1iZXIoJCgnYW5nbGUnKS52YWx1ZSk7cmVuZGVyUHJldmlldygpO307CmZvcihjb25zdCBrIG9mIFsnaGVhZGxpbmUnLCdib2R5J10pJChrKS5vbmlucHV0PSgpPT57YWRzW3NlbGVjdGVkXVtrXT0kKGspLnZhbHVlOyQoJ3ByZXZpZXdIZWFkbGluZScpLnRleHRDb250ZW50PWFkc1tzZWxlY3RlZF0uaGVhZGxpbmU7JCgncHJldmlld0JvZHknKS50ZXh0Q29udGVudD1hZHNbc2VsZWN0ZWRdLmJvZHk7fTsKZm9yKGNvbnN0IGsgb2YgWydicmFuZCcsJ2N0YSddKSQoaykub25pbnB1dD1yZW5kZXJQcmV2aWV3OwpmdW5jdGlvbiB0YWIoaWQpe2Zvcihjb25zdCBiIG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXRhYl0nKSl7Y29uc3QgYWN0aXZlPWIuZGF0YXNldC50YWI9PT1pZDtiLnNldEF0dHJpYnV0ZSgnYXJpYS1zZWxlY3RlZCcsU3RyaW5nKGFjdGl2ZSkpOyQoYi5kYXRhc2V0LnRhYikuaGlkZGVuPSFhY3RpdmU7fX0KZm9yKGNvbnN0IGIgb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdGFiXScpKWIub25jbGljaz0oKT0+dGFiKGIuZGF0YXNldC50YWIpOwokKCdzYXZlJykub25jbGljaz1zYXZlOwokKCdjb3B5Jykub25jbGljaz0oKT0+Y29weShgJHthZHNbc2VsZWN0ZWRdLmhlYWRsaW5lfVxuXG4ke2Fkc1tzZWxlY3RlZF0uYm9keX1cblxuJHskKCdjdGEnKS52YWx1ZX1gKTsKJCgnY2FtcGFpZ25FeHBvcnQnKS5vbmNsaWNrPSgpPT57dHJ5e2Rvd25sb2FkKCdoZXJjdWxlcy1jYW1wYWlnbi5qc29uJyxKU09OLnN0cmluZ2lmeSh7c2NoZW1hOidoZXJjdWxlcy5hZC1zdHVkaW8udjEnLGNhbXBhaWduczpbc25hcHNob3QoKV19LG51bGwsMiksJ2FwcGxpY2F0aW9uL2pzb24nKTt9Y2F0Y2goZSl7dG9hc3QoZS5tZXNzYWdlKTt9fTsKJCgnYmFja3VwJykub25jbGljaz0oKT0+e2lmKHNhdmUoKSlkb3dubG9hZCgnaGVyY3VsZXMtYWQtc3R1ZGlvLWJhY2t1cC5qc29uJyxKU09OLnN0cmluZ2lmeSh7c2NoZW1hOidoZXJjdWxlcy5hZC1zdHVkaW8udjEnLGNhbXBhaWduczpzYXZlZH0sbnVsbCwyKSwnYXBwbGljYXRpb24vanNvbicpO307CmNvbnN0IG1vbmV5PW49Pm49PT1udWxsPyfigJQnOm5ldyBJbnRsLk51bWJlckZvcm1hdCgnZW4tVVMnLHtzdHlsZTonY3VycmVuY3knLGN1cnJlbmN5OidVU0QnfSkuZm9ybWF0KG4pLGRlY2ltYWw9KG4sc3VmZml4PScnKT0+bj09PW51bGw/J+KAlCc6bi50b0ZpeGVkKDIpK3N1ZmZpeDsKZnVuY3Rpb24gdXBkYXRlUGxhbigpe3RyeXtjb25zdCBwPVN0dWRpby5hbGxvY2F0aW9uKCQoJ2J1ZGdldCcpLnZhbHVlLCQoJ2RheXMnKS52YWx1ZSwkKCd2YXJpYW50cycpLnZhbHVlKTskKCdwbGFuTnVtYmVycycpLnRleHRDb250ZW50PWAke21vbmV5KHAuZGFpbHkpfSAvIGRheSB0b3RhbCDCtyAke21vbmV5KHAucGVyQ3JlYXRpdmUpfSBwZXIgdmFyaWF0aW9uIG92ZXIgdGhlIHRlc3QgwrcgJHttb25leShwLnBlckNyZWF0aXZlRGFpbHkpfSAvIHZhcmlhdGlvbiAvIGRheWA7fWNhdGNoKGUpeyQoJ3BsYW5OdW1iZXJzJykudGV4dENvbnRlbnQ9ZS5tZXNzYWdlO310cnl7JCgndHJhY2tpbmcnKS52YWx1ZT1TdHVkaW8ubGluaygkKCd1cmwnKS52YWx1ZSx7c291cmNlOiQoJ3NvdXJjZScpLnZhbHVlLG1lZGl1bTokKCdtZWRpdW0nKS52YWx1ZSxjYW1wYWlnbjokKCd1dG1DYW1wYWlnbicpLnZhbHVlLGNvbnRlbnQ6JCgnY29udGVudCcpLnZhbHVlfSk7fWNhdGNoeyQoJ3RyYWNraW5nJykudmFsdWU9J0FkZCBhIHZhbGlkIEhUVFBTIGxhbmRpbmcgcGFnZSBpbiBDcmVhdGUgdG8gZ2VuZXJhdGUgeW91ciBsaW5rLic7fX0KZm9yKGNvbnN0IGsgb2YgWy4uLnBsYW5GaWVsZHMsJ3VybCddKSQoaykuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLHVwZGF0ZVBsYW4pOwokKCdjb3B5TGluaycpLm9uY2xpY2s9KCk9PntpZigkKCd0cmFja2luZycpLnZhbHVlLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykpY29weSgkKCd0cmFja2luZycpLnZhbHVlKTtlbHNlIHRvYXN0KCdTZXQgeW91ciBIVFRQUyBsYW5kaW5nIHBhZ2UgZmlyc3QuJyk7fTsKZnVuY3Rpb24gcmVuZGVyUmVzdWx0cygpe2NvbnN0IHRvdGFsPXJlc3VsdHMucmVkdWNlKChhLHIpPT57Zm9yKGNvbnN0IGsgb2YgT2JqZWN0LmtleXMoYSkpYVtrXSs9TnVtYmVyKHJba10pO3JldHVybiBhO30se3NwZW5kOjAsaW1wcmVzc2lvbnM6MCxjbGlja3M6MCxjb252ZXJzaW9uczowLHJldmVudWU6MH0pLG09U3R1ZGlvLm1ldHJpY3ModG90YWwpOyQoJ3N0YXRzJykucmVwbGFjZUNoaWxkcmVuKC4uLltbJ1RvdGFsIHNwZW5kJyxtb25leShtLnNwZW5kKV0sWydDb252ZXJzaW9ucycsU3RyaW5nKG0uY29udmVyc2lvbnMpXSxbJ0Nvc3QgLyBjb252ZXJzaW9uJyxtb25leShtLmNwYSldLFsnUk9BUycsZGVjaW1hbChtLnJvYXMsJ8OXJyldXS5tYXAoKFtsYWJlbCx2XSk9Pntjb25zdCBkPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO2QuY2xhc3NOYW1lPSdzdGF0Jztjb25zdCBsPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtsLnRleHRDb250ZW50PWxhYmVsO2wuY2xhc3NOYW1lPSdtdXRlZCc7Y29uc3QgYj1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHJvbmcnKTtiLnRleHRDb250ZW50PXY7ZC5hcHBlbmQobCxiKTtyZXR1cm4gZDt9KSk7JCgnbGVkZ2VyJykucmVwbGFjZUNoaWxkcmVuKC4uLnJlc3VsdHMubWFwKHI9Pntjb25zdCBtPVN0dWRpby5tZXRyaWNzKHIpLHRyPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RyJyk7Zm9yKGNvbnN0IHYgb2YgW3IubmFtZSxtb25leShtLnNwZW5kKSxkZWNpbWFsKG0uY3RyLCclJyksbW9uZXkobS5jcGMpLG1vbmV5KG0uY3BhKSxkZWNpbWFsKG0ucm9hcywnw5cnKV0pe2NvbnN0IHRkPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RkJyk7dGQudGV4dENvbnRlbnQ9djt0ci5hcHBlbmQodGQpO31jb25zdCB0ZD1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZCcpLGI9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7Yi50ZXh0Q29udGVudD0nUmVtb3ZlJztiLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsJ1JlbW92ZSAnK3IubmFtZSk7Yi5vbmNsaWNrPSgpPT57aWYoY29uZmlybSgnUmVtb3ZlIHRoaXMgcmVzdWx0PycpKXtyZXN1bHRzPXJlc3VsdHMuZmlsdGVyKHg9PnguaWQhPT1yLmlkKTtkaXJ0eT10cnVlO3JlbmRlclJlc3VsdHMoKTt0b2FzdCgnUmVzdWx0IHJlbW92ZWQuIFNhdmUgY2FtcGFpZ24gdG8ga2VlcCB0aGlzIGNoYW5nZS4nKTt9fTt0ZC5hcHBlbmQoYik7dHIuYXBwZW5kKHRkKTtyZXR1cm4gdHI7fSkpO2lmKCFyZXN1bHRzLmxlbmd0aCl7Y29uc3QgdHI9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndHInKSx0ZD1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZCcpO3RkLmNvbFNwYW49Nzt0ZC5jbGFzc05hbWU9J2VtcHR5Jzt0ZC50ZXh0Q29udGVudD0nTm8gcmVzdWx0cyB5ZXQuIFlvdXIgcmVhbCBudW1iZXJzIGJlbG9uZyBoZXJlLic7dHIuYXBwZW5kKHRkKTskKCdsZWRnZXInKS5hcHBlbmQodHIpO319CiQoJ3Jlc3VsdEZvcm0nKS5vbnN1Ym1pdD1lPT57ZS5wcmV2ZW50RGVmYXVsdCgpO3RyeXtjb25zdCByPXtpZDpjcnlwdG8ucmFuZG9tVVVJRCgpLG5hbWU6JCgncmVzdWx0TmFtZScpLnZhbHVlLnRyaW0oKSwuLi5TdHVkaW8ubWV0cmljcyhPYmplY3QuZnJvbUVudHJpZXMoWydzcGVuZCcsJ2ltcHJlc3Npb25zJywnY2xpY2tzJywnY29udmVyc2lvbnMnLCdyZXZlbnVlJ10ubWFwKGs9PltrLCQoaykudmFsdWVdKSkpfTtpZighci5uYW1lKXRocm93IEVycm9yKCdFbnRlciBhbiBleHBlcmltZW50IG5hbWUuJyk7cmVzdWx0cy5wdXNoKHIpO2RpcnR5PXRydWU7cmVuZGVyUmVzdWx0cygpO3RvYXN0KCdSZXN1bHQgYWRkZWQuIFNhdmUgY2FtcGFpZ24gdG8ga2VlcCBpdC4nKTskKCdyZXN1bHRGb3JtJykucmVzZXQoKTt9Y2F0Y2goZSl7dG9hc3QoZS5tZXNzYWdlKTt9fTsKJCgnY3N2Jykub25jbGljaz0oKT0+ZG93bmxvYWQoJ2hlcmN1bGVzLWFkLXJlc3VsdHMuY3N2JyxTdHVkaW8uY3N2KFtbJ2NyZWF0aXZlJywnc3BlbmQnLCdpbXByZXNzaW9ucycsJ2NsaWNrcycsJ2NvbnZlcnNpb25zJywncmV2ZW51ZScsJ2N0cl9wZXJjZW50JywnY3BjJywnY3BhJywncm9hcyddLC4uLnJlc3VsdHMubWFwKHI9Pntjb25zdCBtPVN0dWRpby5tZXRyaWNzKHIpO3JldHVybiBbci5uYW1lLC4uLlsnc3BlbmQnLCdpbXByZXNzaW9ucycsJ2NsaWNrcycsJ2NvbnZlcnNpb25zJywncmV2ZW51ZScsJ2N0cicsJ2NwYycsJ2NwYScsJ3JvYXMnXS5tYXAoaz0+bVtrXT8/JycpXTt9KV0pLCd0ZXh0L2NzdjtjaGFyc2V0PXV0Zi04Jyk7CmZ1bmN0aW9uIGxvYWQoYyl7ZGlydHk9ZmFsc2U7Y3VycmVudElkPWMuaWQ7Zm9yKGNvbnN0IGsgb2YgU3R1ZGlvLmZpZWxkcykkKGspLnZhbHVlPWMuZm9ybVtrXTtmb3IoY29uc3QgayBvZiBwbGFuRmllbGRzKSQoaykudmFsdWU9Yy5wbGFuW2tdO2Fkcz1zdHJ1Y3R1cmVkQ2xvbmUoYy5hZHMpO3Jlc3VsdHM9c3RydWN0dXJlZENsb25lKGMucmVzdWx0cyk7c2VsZWN0ZWQ9MDtyZW5kZXJBbmdsZXMoKTt1cGRhdGVQbGFuKCk7cmVuZGVyUmVzdWx0cygpO3RhYignY3JlYXRlJyk7fQpmdW5jdGlvbiByZW5kZXJMaWJyYXJ5KCl7JCgnY2FtcGFpZ25zJykucmVwbGFjZUNoaWxkcmVuKC4uLnNhdmVkLm1hcChjPT57Y29uc3Qgcm93PWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO3Jvdy5jbGFzc05hbWU9J2xpYnJhcnktaXRlbSc7Y29uc3QgdGl0bGU9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7dGl0bGUudGV4dENvbnRlbnQ9Yy5mb3JtLm5hbWUrJyDCtyAnK2MuZm9ybS5jaGFubmVsO2NvbnN0IGFjdGlvbnM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7YWN0aW9ucy5jbGFzc05hbWU9J3JvdyBhY3Rpb25zJztjb25zdCBiPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO2IudGV4dENvbnRlbnQ9J09wZW4nO2Iub25jbGljaz0oKT0+e2lmKGNvbmZpcm0oJ09wZW4gc2F2ZWQgY2FtcGFpZ24/IEV4cG9ydCBvciBzYXZlIGN1cnJlbnQgZWRpdHMgZmlyc3QuJykpbG9hZChjKTt9O2NvbnN0IGRlbD1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtkZWwudGV4dENvbnRlbnQ9J0RlbGV0ZSc7ZGVsLmNsYXNzTmFtZT0nZGFuZ2VyJztkZWwub25jbGljaz0oKT0+e2lmKGNvbmZpcm0oJ0RlbGV0ZSB0aGlzIHNhdmVkIGNhbXBhaWduIGZyb20gdGhpcyBicm93c2VyPycpKXtzYXZlZD1zYXZlZC5maWx0ZXIoeD0+eC5pZCE9PWMuaWQpO3BlcnNpc3QoKTtyZW5kZXJMaWJyYXJ5KCk7fX07YWN0aW9ucy5hcHBlbmQoYixkZWwpO3Jvdy5hcHBlbmQodGl0bGUsYWN0aW9ucyk7cmV0dXJuIHJvdzt9KSk7aWYoIXNhdmVkLmxlbmd0aCkkKCdjYW1wYWlnbnMnKS50ZXh0Q29udGVudD0nTm8gc2F2ZWQgY2FtcGFpZ25zIHlldC4gQ3JlYXRlIHlvdXIgZmlyc3Qgb25lLCB0aGVuIHNlbGVjdCBTYXZlIGNhbXBhaWduLic7fQokKCduZXcnKS5vbmNsaWNrPSgpPT57aWYoY29uZmlybSgnU3RhcnQgYSBuZXcgY2FtcGFpZ24/IFNhdmUgb3IgZXhwb3J0IGN1cnJlbnQgZWRpdHMgZmlyc3QuJykpe2xvYWQoU3R1ZGlvLmNsZWFuQ2FtcGFpZ24oe2lkOmNyeXB0by5yYW5kb21VVUlEKCksZm9ybTp7Li4uZGVmYXVsdHMsbmFtZTonTmV3IEhlcmN1bGVzIGNhbXBhaWduJ30sYWRzOlN0dWRpby5nZW5lcmF0ZShkZWZhdWx0cykscmVzdWx0czpbXX0pKTt9fTsKJCgncmVzdG9yZScpLm9uY2xpY2s9KCk9PiQoJ3Jlc3RvcmVGaWxlJykuY2xpY2soKTsKJCgncmVzdG9yZUZpbGUnKS5vbmNoYW5nZT1hc3luYygpPT57Y29uc3QgZj0kKCdyZXN0b3JlRmlsZScpLmZpbGVzWzBdO2lmKCFmKXJldHVybjt0cnl7aWYoZi5zaXplPjVlNil0aHJvdyBFcnJvcignQmFja3VwIGV4Y2VlZHMgNSBNQi4nKTtjb25zdCBpbXBvcnRlZD1TdHVkaW8ucmVzdG9yZShKU09OLnBhcnNlKGF3YWl0IGYudGV4dCgpKSk7aWYoc2F2ZWQubGVuZ3RoK2ltcG9ydGVkLmxlbmd0aD4yMDApdGhyb3cgRXJyb3IoJ0ltcG9ydCB3b3VsZCBleGNlZWQgMjAwIHNhdmVkIGNhbXBhaWducy4nKTtmb3IoY29uc3QgYyBvZiBpbXBvcnRlZCljLmlkPWNyeXB0by5yYW5kb21VVUlEKCk7c2F2ZWQucHVzaCguLi5pbXBvcnRlZCk7cGVyc2lzdCgpO3JlbmRlckxpYnJhcnkoKTt0b2FzdChgJHtpbXBvcnRlZC5sZW5ndGh9IGNhbXBhaWducyBpbXBvcnRlZCBhcyBzZXBhcmF0ZSBjb3BpZXMuYCk7fWNhdGNoKGUpe3RvYXN0KGUubWVzc2FnZSk7fWZpbmFsbHl7JCgncmVzdG9yZUZpbGUnKS52YWx1ZT0nJzt9fTsKJCgncG5nJykub25jbGljaz0oKT0+e2NvbnN0IGM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7Yy53aWR0aD1jLmhlaWdodD0xMDgwO2NvbnN0IGN0eD1jLmdldENvbnRleHQoJzJkJyk7Y3R4LmZpbGxTdHlsZT0nIzEwMTUxYic7Y3R4LmZpbGxSZWN0KDAsMCwxMDgwLDEwODApO2NvbnN0IGc9Y3R4LmNyZWF0ZVJhZGlhbEdyYWRpZW50KDk4MCwwLDIwLDgwMCwxMDAsMTAwMCk7Zy5hZGRDb2xvclN0b3AoMCwnIzY2NTAzMCcpO2cuYWRkQ29sb3JTdG9wKDEsJyMxMDE1MWInKTtjdHguZmlsbFN0eWxlPWc7Y3R4LmZpbGxSZWN0KDAsMCwxMDgwLDEwODApO2N0eC5zdHJva2VTdHlsZT0nIzhhNmQzYyc7Y3R4LnN0cm9rZVJlY3QoMzIsMzIsMTAxNiwxMDE2KTtjdHguZmlsbFN0eWxlPScjZTliZDcwJztjdHguZm9udD0nYm9sZCAyOHB4IHNhbnMtc2VyaWYnO2N0eC5maWxsVGV4dCgkKCdicmFuZCcpLnZhbHVlLnRvVXBwZXJDYXNlKCksNzUsMTEwLDkzMCk7ZnVuY3Rpb24gd3JhcCh0ZXh0LHksc2l6ZSxjb2xvcixtYXhMaW5lcyl7Y3R4LmZvbnQ9YCR7c2l6ZT49NDA/J2JvbGQgJzonJ30ke3NpemV9cHggc2Fucy1zZXJpZmA7Y3R4LmZpbGxTdHlsZT1jb2xvcjtjb25zdCB3b3Jkcz1BcnJheS5mcm9tKHRleHQpLGxpbmVzPVtdO2xldCBsaW5lPScnO2Zvcihjb25zdCBjaCBvZiB3b3Jkcyl7aWYoY3R4Lm1lYXN1cmVUZXh0KGxpbmUrY2gpLndpZHRoPjkyMCl7bGluZXMucHVzaChsaW5lKTtsaW5lPWNoO31lbHNlIGxpbmUrPWNoO31pZihsaW5lKWxpbmVzLnB1c2gobGluZSk7aWYobGluZXMubGVuZ3RoPm1heExpbmVzKXJldHVybiBmYWxzZTtmb3IoY29uc3QgbCBvZiBsaW5lcyl7Y3R4LmZpbGxUZXh0KGwsNzUseSk7eSs9c2l6ZSoxLjM7fXJldHVybiB5O31sZXQgeT13cmFwKGFkc1tzZWxlY3RlZF0uaGVhZGxpbmUsMjYwLDY0LCcjZjVmNGVmJyw0KTtpZih5PT09ZmFsc2Upe3RvYXN0KCdTaG9ydGVuIHRoZSBoZWFkbGluZSBiZWZvcmUgZXhwb3J0aW5nIHRoaXMgZ3JhcGhpYy4nKTtyZXR1cm47fXk9d3JhcChhZHNbc2VsZWN0ZWRdLmJvZHkseSs0MiwyOSwnI2QzZDZkOCcsOCk7aWYoeT09PWZhbHNlfHx5Pjg5MCl7dG9hc3QoJ1Nob3J0ZW4gdGhlIHByaW1hcnkgdGV4dCBiZWZvcmUgZXhwb3J0aW5nIHRoaXMgZ3JhcGhpYy4nKTtyZXR1cm47fWN0eC5maWxsU3R5bGU9JyNlOWJkNzAnO2N0eC5maWxsUmVjdCg3NSw5MjcsNDcwLDc1KTtjdHguZmlsbFN0eWxlPScjMTAxMDEwJztjdHguZm9udD0nYm9sZCAyN3B4IHNhbnMtc2VyaWYnO2N0eC5maWxsVGV4dCgkKCdjdGEnKS52YWx1ZSwxMDIsOTc1LDQxNik7Yy50b0Jsb2IoYmxvYj0+e2lmKCFibG9iKXt0b2FzdCgnUE5HIGV4cG9ydCBmYWlsZWQuJyk7cmV0dXJuO31kb3dubG9hZCgnaGVyY3VsZXMtYWQtMTA4MC5wbmcnLGJsb2IsJ2ltYWdlL3BuZycpO30pO307CnRyeXtjb25zdCByYXc9bG9jYWxTdG9yYWdlLmdldEl0ZW0oa2V5KTtpZihyYXcpc2F2ZWQ9U3R1ZGlvLnJlc3RvcmUoSlNPTi5wYXJzZShyYXcpKTt9Y2F0Y2h7dG9hc3QoJ1NhdmVkIGRhdGEgY291bGQgbm90IGJlIGxvYWRlZC4gSW1wb3J0IGEgdmFsaWQgYmFja3VwIG9yIGV4cG9ydCB5b3VyIG5ldyB3b3JrLicpO30KZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCgpPT57ZGlydHk9dHJ1ZTt9KTsKd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2JlZm9yZXVubG9hZCcsZT0+e2lmKGRpcnR5KXtlLnByZXZlbnREZWZhdWx0KCk7ZS5yZXR1cm5WYWx1ZT0nJzt9fSk7CmlmKHNhdmVkLmxlbmd0aClsb2FkKHNhdmVkW3NhdmVkLmxlbmd0aC0xXSk7ZWxzZXthZHM9U3R1ZGlvLmdlbmVyYXRlKGZvcm0oKSk7cmVuZGVyQW5nbGVzKCk7dXBkYXRlUGxhbigpO3JlbmRlclJlc3VsdHMoKTt9cmVuZGVyTGlicmFyeSgpOwo8L3NjcmlwdD48L2JvZHk+PC9odG1sPgo=";
function readAttribution(){
  let saved={};try{saved=JSON.parse(localStorage.getItem("hercules_attribution_v1")||"{}")||{}}catch{}
  if(saved.attribution_id)return saved;
  const q=new URLSearchParams(location.search);
  let refSource="direct";
  try{if(document.referrer){const r=new URL(document.referrer);if(r.origin!==location.origin)refSource=r.hostname||"referral"}}catch{}
  saved={
    source:(q.get("utm_source")||refSource||"direct").slice(0,100),
    medium:(q.get("utm_medium")||(q.get("utm_source")?"organic":"organic")).slice(0,100),
    campaign:(q.get("utm_campaign")||"founding-pilot-organic-v1").slice(0,120),
    content:(q.get("utm_content")||"unspecified").slice(0,120),
    attribution_id:crypto.randomUUID()
  };
  try{localStorage.setItem("hercules_attribution_v1",JSON.stringify(saved))}catch{}
  return saved;
}
const acquisition=readAttribution();
async function track(eventName,properties={}){try{await fetch(location.href,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"marketing_event",event_name:eventName,properties:Object.assign({path:location.pathname,referrer:document.referrer||null},acquisition,properties)})})}catch{}}
track("landing_view",{surface:"landing"});
function ensureAdStudioLoaded(){const frame=$("adStudioFrame");if(!frame||frame.dataset.loaded==="1")return;const raw=atob(AD_STUDIO_SRC_B64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));frame.srcdoc=new TextDecoder().decode(bytes);frame.dataset.loaded="1";track("ad_studio_opened",{surface:"workspace"})}

function show(id,on=true){$(id).classList.toggle("hidden",!on)}
function setNotice(id,text,tone){const el=$(id);el.textContent=text;el.className="notice "+(tone||"");show(id,Boolean(text))}
function safe(v){return v==null?"—":String(v)}
async function sessionToken(){return (await sb.auth.getSession()).data.session?.access_token||""}
async function fetchFn(name,options){
  const t=await sessionToken();
  const o=options||{};
  o.headers=Object.assign({"content-type":"application/json","apikey":K},o.headers||{});
  if(t)o.headers.Authorization="Bearer "+t;
  const r=await fetch(U+"/functions/v1/"+name,o);
  const txt=await r.text();let d={};try{d=txt?JSON.parse(txt):{}}catch{d={raw:txt}}
  if(!r.ok)throw new Error(d.detail||d.error||("HTTP "+r.status));
  return d;
}
function switchRoot(target){show("landing",target==="landing");show("auth",target==="auth");show("app",target==="app");show("publicNav",target!=="app");show("appActions",target==="app")}
async function refreshRegistrationState(){try{const r=await fetch(U+"/functions/v1/hercules-launch-gate",{headers:{apikey:K},cache:"no-store"});const d=await r.json().catch(()=>({}));publicSignupOpen=Boolean(r.ok&&d?.lastCheck?.launch_ready===true&&d?.publicRegistrationOpen===true)}catch{publicSignupOpen=false}const sw=$("authSwitch");if(sw&&authMode==="signin"){sw.disabled=!publicSignupOpen;sw.textContent=publicSignupOpen?"Create account":"Early access — sign-in only"}return publicSignupOpen}
async function openProduct(){const s=(await sb.auth.getSession()).data.session;if(s){await bootApp();return}switchRoot("auth");const open=await refreshRegistrationState();if(!open)setNotice("authMsg","Public account creation is not open yet. Existing authorized users can sign in.","warn")}
$("openHercules").onclick=()=>{track("cta_open_product",{surface:"nav"});openProduct()};$("systemOpen").onclick=()=>{track("cta_open_product",{surface:"system"});openProduct()};$("backHome").onclick=()=>switchRoot("landing");
$("heroProof").onclick=()=>track("proof_demo_interest",{surface:"hero"});
$("heroPilot").onclick=()=>track("pilot_interest",{surface:"hero"});
const demoSteps=[
 ["Evidence loaded","Three synthetic receivables enter with source facts preserved."],
 ["Current state established","Hercules distinguishes routine overdue, disputed, and promised-payment cases."],
 ["Safe routes planned","Each case receives the smallest evidence-backed next route."],
 ["Consequences gated","External action stays behind approval where required."],
 ["Proof retained","The workflow reaches a verified useful action with an inspectable trail."]
];
$("demoRun").onclick=async()=>{track("proof_demo_started",{dataset:"synthetic-v1"});const steps=[...document.querySelectorAll("#demoProgress div")];steps.forEach(x=>x.className="");$("demoRun").disabled=true;for(let i=0;i<demoSteps.length;i++){steps.slice(0,i).forEach(x=>x.className="done");steps[i].className="active";$("demoHeadline").textContent=demoSteps[i][0];$("demoDetail").textContent=demoSteps[i][1];await new Promise(r=>setTimeout(r,850))}steps.forEach(x=>x.className="done");$("demoHeadline").textContent="Verified useful action reached.";$("demoDetail").textContent="The synthetic proof finished without sending an external collection action.";track("first_verified_useful_action",{surface:"proof_demo",dataset:"synthetic-v1"});$("demoRun").disabled=false};
$("privacyForm").onsubmit=async e=>{
  e.preventDefault();setNotice("privacyRequestMsg","");
  const category=$("privacyRequestType").value,email=$("privacyEmail").value.trim().toLowerCase(),message=$("privacyMessage").value.trim(),website=$("privacyWebsite").value.trim();
  const btn=e.submitter||$("privacyForm").querySelector("button[type=submit]");if(btn)btn.disabled=true;
  try{
    const r=await fetch(location.href,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"privacy_request",category,email,message,website})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||"Request failed");
    const reference=d.reference?(" Reference: "+d.reference):"";
    setNotice("privacyRequestMsg","Request received."+reference+" Keep this reference for follow-up.","good");
    e.target.reset();
  }catch(err){
    setNotice("privacyRequestMsg","Request could not be recorded: "+err.message,"bad");
  }finally{if(btn)btn.disabled=false}
};
$("pilotForm").onsubmit=async e=>{e.preventDefault();setNotice("pilotMsg","");const email=$("pilotEmail").value.trim(),first_name=$("pilotName").value.trim(),company=$("pilotCompany").value.trim(),role=$("pilotRole").value,website=$("pilotWebsite").value;if(!email){setNotice("pilotMsg","Enter a business email.","bad");return}const btn=e.submitter||$("pilotForm").querySelector("button[type=submit]");if(btn)btn.disabled=true;try{const r=await fetch(location.href,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"pilot_request",email,first_name,company,role,website,referrer:document.referrer||null,attribution:acquisition})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Request failed");setNotice("pilotMsg","Pilot request received. Hercules recorded the request for controlled follow-up.","good");e.target.reset()}catch(err){setNotice("pilotMsg","Pilot request could not be recorded: "+err.message,"bad")}finally{if(btn)btn.disabled=false}};

$("authSwitch").onclick=async()=>{if(authMode==="signin"&&!publicSignupOpen){const open=await refreshRegistrationState();if(!open){setNotice("authMsg","Public account creation is not open yet. Existing authorized users can sign in.","warn");return}}authMode=authMode==="signin"?"signup":"signin";$("authTitle").textContent=authMode==="signin"?"Sign in":"Create account";$("authSubmit").textContent=authMode==="signin"?"Sign in":"Create account";$("authSwitch").disabled=false;$("authSwitch").textContent=authMode==="signin"?(publicSignupOpen?"Create account":"Early access — sign-in only"):"Sign in instead";setNotice("authMsg","")};
async function checkPasswordSafety(password){const r=await fetch(location.href,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"password_breach_check",password})});const d=await r.json().catch(()=>({}));if(r.ok&&d.safe===true)return true;if(d.error==="compromised_password")throw new Error("Choose a password that has not appeared in known data breaches.");if(d.error==="weak_password_length")throw new Error("Use at least 12 characters for your password.");throw new Error("Password safety check is unavailable. Account creation is temporarily paused.")}
$("authSubmit").onclick=async()=>{setNotice("authMsg","");if(authMode==="signup"&&!await refreshRegistrationState()){authMode="signin";$("authTitle").textContent="Sign in";$("authSubmit").textContent="Sign in";setNotice("authMsg","Public account creation is not open yet. Existing authorized users can sign in.","warn");return}const email=$("email").value.trim(),password=$("password").value;if(authMode==="signin"){const q=await sb.auth.signInWithPassword({email,password});if(q.error){setNotice("authMsg",q.error.message,"bad");return}await bootApp();return}try{await checkPasswordSafety(password)}catch(error){setNotice("authMsg",error instanceof Error?error.message:"Password safety check failed.","bad");return}const r=await fetch(location.href,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"secure_signup",email,password})});const d=await r.json().catch(()=>({}));if(!r.ok){setNotice("authMsg",d.error==="compromised_password"?"Choose a password that has not appeared in known data breaches.":d.error==="weak_password_length"?"Use at least 12 characters for your password.":d.error||"Account creation failed.","bad");return}if(!d.session){setNotice("authMsg","Check your email to confirm the account, then sign in.","good");return}const q=await sb.auth.setSession(d.session);if(q.error){setNotice("authMsg",q.error.message,"bad");return}await bootApp()};
$("signOut").onclick=async()=>{await sb.auth.signOut();user=null;project=null;orgId=null;orgSlug=null;switchRoot("landing")};

const BLOCKED_RECOVERY_STATES=new Set(["disputed","promise_active","paid","do_not_contact","unverified_history","manual_review"]);
function recoveryCaseLabel(state){return ({contact_ready:"Contact ready",disputed:"Disputed",promise_active:"Active payment promise",paid:"Paid/closed",do_not_contact:"Do not contact",unverified_history:"Unverified history",manual_review:"Manual review"})[state]||"Manual review"}
function recoveryGuidance(){const state=$("recoveryCaseState").value;const blocked=BLOCKED_RECOVERY_STATES.has(state);$("recoveryGuidance").textContent=blocked?"Human review required — Hercules will record this case but will not queue external follow-up.":"Contact-ready cases can queue only the email/SMS channels you explicitly provide."; $("recoveryGuidance").className="notice "+(blocked?"warn":"good")}
$("recoveryCaseState").onchange=recoveryGuidance;
function money(cents,currency="USD"){try{return new Intl.NumberFormat(undefined,{style:"currency",currency:currency||"USD"}).format(Number(cents||0)/100)}catch{return "$"+(Number(cents||0)/100).toFixed(2)}}
function recoveryCaseCard(row){
  const box=document.createElement("div");box.className="result";
  const head=document.createElement("div");head.className="row";head.style.justifyContent="space-between";
  const h=document.createElement("h3");h.textContent=(row.first_name||row.email||row.phone||"Receivable")+" · "+money(row.estimated_value_cents,row.currency);
  const state=String(row.context?.caseState||"manual_review");const blocked=BLOCKED_RECOVERY_STATES.has(state);
  const pill=document.createElement("span");pill.className="pill";pill.textContent=blocked?"Human review required":recoveryCaseLabel(state);
  head.append(h,pill);
  const p=document.createElement("p");p.textContent=[row.external_key||"No invoice reference",recoveryCaseLabel(state),row.status||"new",row.next_follow_up_at?("Next action "+new Date(row.next_follow_up_at).toLocaleString()):"No external follow-up queued"].join(" · ");
  const actions=document.createElement("div");actions.className="row";actions.style.marginTop="10px";
  if(!["won","lost","opted_out","human_handoff","booked"].includes(String(row.status||""))){
    for(const [signal,label] of [["won","Mark recovered"],["human_requested","Needs human"],["opt_out","Do not contact"]]){
      const b=document.createElement("button");b.type="button";b.className="btn small";b.textContent=label;b.dataset.recoverySignal=signal;b.dataset.leadId=row.id;b.dataset.amountCents=String(row.estimated_value_cents||0);actions.appendChild(b)
    }
  }
  box.append(head,p,actions);return box
}
async function loadRecovery(){
  const summary=$("recoverySummary"),list=$("recoveryLeads");summary.textContent="";list.textContent="";$("recoveryState").innerHTML="<span class='dot'></span>Loading cases";
  try{
    const oid=await ensureOrg();
    const [dash,leadData]=await Promise.all([
      fetchFn("hercules-revenue-rescue",{method:"POST",body:JSON.stringify({action:"dashboard",organizationId:oid})}),
      fetchFn("hercules-revenue-rescue",{method:"POST",body:JSON.stringify({action:"leads",organizationId:oid,limit:50})})
    ]);
    const m=dash.metrics||{},rows=leadData.leads||[];
    summary.append(kpi("Receivables",m.total_leads??0),kpi("Recovered",money(m.recovered_revenue_cents,m.currency||"USD")),kpi("Queued follow-up",m.queued_actions??0));
    if(!rows.length){const empty=document.createElement("div");empty.className="result";const h=document.createElement("h3");h.textContent="No recovery cases yet.";const p=document.createElement("p");p.textContent="Add the first receivable on the left. Hercules will preserve its source reference and route it from the current case state.";empty.append(h,p);list.appendChild(empty)}
    else rows.forEach(row=>list.appendChild(recoveryCaseCard(row)));
    $("recoveryState").innerHTML="<span class='dot good'></span>"+rows.length+" case"+(rows.length===1?"":"s");
  }catch(e){
    const error=document.createElement("div");error.className="notice bad";error.textContent="Recovery Desk unavailable: "+e.message;list.appendChild(error);$("recoveryState").innerHTML="<span class='dot bad'></span>Recovery Desk unavailable";
  }
}
$("recoveryRefresh").onclick=loadRecovery;
$("recoveryForm").onsubmit=async e=>{
  e.preventDefault();setNotice("recoveryFormResult","");
  const state=$("recoveryCaseState").value,email=$("recoveryEmail").value.trim(),phone=$("recoveryPhone").value.trim(),invoice=$("recoveryInvoice").value.trim(),customer=$("recoveryCustomer").value.trim();
  const amount=Math.round(Number($("recoveryAmount").value||0)*100),days=Math.max(0,Math.trunc(Number($("recoveryDaysOverdue").value||0)));
  if(!invoice){setNotice("recoveryFormResult","Invoice reference is required.","bad");return}
  if(!Number.isInteger(amount)||amount<0){setNotice("recoveryFormResult","Enter a valid non-negative amount.","bad");return}
  if(state==="contact_ready"&&!email&&!phone){setNotice("recoveryFormResult","Contact-ready cases need an email or phone. Otherwise choose Manual review.","bad");return}
  const blocked=BLOCKED_RECOVERY_STATES.has(state),channels=blocked?["internal"]:[...(email?["email"]:[]),...(phone?["sms"]:[])];
  const btn=$("recoverySubmit");btn.disabled=true;btn.textContent="Adding…";
  try{
    const oid=await ensureOrg();
    const d=await fetchFn("hercules-revenue-rescue",{method:"POST",body:JSON.stringify({action:"ingest",organizationId:oid,lead:{source:$("recoverySource").value,externalKey:invoice,firstName:customer||null,email:email||null,phone:phone||null,currency:"USD",estimatedValueCents:amount,allowedChannels:channels,context:{caseState:state,invoiceRef:invoice,daysOverdue:days}}})});
    const msg=blocked||Number(d.queuedActions||0)===0?"Case recorded. Human review required; no external follow-up was queued.":"Case recorded. "+d.queuedActions+" permitted follow-up action"+(d.queuedActions===1?" was":"s were")+" queued.";
    setNotice("recoveryFormResult",msg,blocked?"warn":"good");track("first_verified_useful_action",{surface:"recovery_desk",project_id:project?.id||null});e.target.reset();$("recoveryDaysOverdue").value="1";recoveryGuidance();await loadRecovery()
  }catch(err){setNotice("recoveryFormResult","Case could not be added: "+err.message,"bad")}
  finally{btn.disabled=false;btn.textContent="Add to Recovery Desk"}
};
$("recoveryLeads").onclick=async e=>{
  const btn=e.target.closest("[data-recovery-signal]");if(!btn)return;btn.disabled=true;
  try{const oid=await ensureOrg();await fetchFn("hercules-revenue-rescue",{method:"POST",body:JSON.stringify({action:"signal",organizationId:oid,leadId:btn.dataset.leadId,signal:btn.dataset.recoverySignal,amountCents:Number(btn.dataset.amountCents||0)})});await loadRecovery()}
  catch(err){const x=document.createElement("div");x.className="notice bad";x.textContent="Case update failed: "+err.message;$("recoveryLeads").prepend(x)}
  finally{btn.disabled=false}
};
recoveryGuidance();

document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",async()=>{document.querySelectorAll("[data-view]").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===b.dataset.view));if(b.dataset.view==="recoveryView")await loadRecovery();if(b.dataset.view==="knowledgeView")await loadKnowledgeStats();if(b.dataset.view==="adStudioView")ensureAdStudioLoaded();if(b.dataset.view==="forgeView")await loadDeployments();if(b.dataset.view==="statusView")await loadStatus()}));

async function ensureProject(){
  const q=await sb.from("hercules_projects").select("id,name,goal,created_at").order("created_at",{ascending:true}).limit(1).maybeSingle();
  if(q.error)throw q.error;
  if(q.data){project=q.data;return}
  const ins=await sb.from("hercules_projects").insert({user_id:user.id,name:"Hercules Command",goal:"Research, build, deploy, and operate through Hercules."}).select("id,name,goal").single();
  if(ins.error)throw ins.error;project=ins.data;
}
function addMessage(type,text,meta){const el=document.createElement("div");el.className="msg "+type;el.textContent=text;$("messages").appendChild(el);if(meta){const m=document.createElement("div");m.className="msg meta";m.textContent=meta;$("messages").appendChild(m)}$("messages").scrollTop=$("messages").scrollHeight}
async function loadMessages(){const q=await sb.from("hercules_sessions").select("prompt,result,created_at").eq("project_id",project.id).order("created_at",{ascending:true}).limit(30);$("messages").textContent="";if(q.error){addMessage("meta","Conversation history could not be loaded.");return}if(!q.data?.length)addMessage("meta","Hercules is ready. Give it a concrete outcome.");for(const r of q.data||[]){addMessage("user",r.prompt);addMessage("ai",r.result)}}
$("sendChat").onclick=async()=>{const p=$("chatPrompt").value.trim();if(!p||!project)return;$("chatPrompt").value="";addMessage("user",p);$("sendChat").disabled=true;$("sendChat").textContent="Working…";try{const d=await fetchFn("hercules-ai",{method:"POST",body:JSON.stringify({projectId:project.id,prompt:p})});addMessage("ai",safe(d.result),"Provider: "+safe(d.provider)+" · Model: "+safe(d.model))}catch(e){addMessage("meta","Hercules could not complete that request: "+e.message)}finally{$("sendChat").disabled=false;$("sendChat").textContent="Send to Hercules"}};

async function loadKnowledgeStats(){try{await ensureOrg();const d=await fetchFn("hercules-knowledge-registry",{method:"POST",body:JSON.stringify({action:"stats",org_slug:orgSlug})});$("knowledgeStats").textContent=safe(d.total)+" registry entries"}catch{$("knowledgeStats").textContent="Registry unavailable"}}
$("knowledgeSearch").onclick=async()=>{const q=$("knowledgeQuery").value.trim();if(!q)return;$("knowledgeResults").textContent="";try{const d=await fetchFn("hercules-knowledge-registry",{method:"POST",body:JSON.stringify({action:"search",org_slug:orgSlug,query:q,limit:20})});if(!d.results?.length){const x=document.createElement("div");x.className="muted";x.textContent="No matching registry entries."; $("knowledgeResults").appendChild(x);return}for(const r of d.results){const box=document.createElement("div");box.className="result";const h=document.createElement("h3");h.textContent=safe(r.title||r.canonical_key);const p=document.createElement("p");p.textContent=safe(r.summary||r.description||"No summary stored.");const meta=document.createElement("div");meta.className="row";meta.style.marginTop="8px";for(const v of [r.category,r.verification_status,r.status].filter(Boolean)){const s=document.createElement("span");s.className="pill";s.textContent=String(v);meta.appendChild(s)}box.append(h,p,meta);$("knowledgeResults").appendChild(box)}}catch(e){setNotice("knowledgeResults","Search failed: "+e.message,"bad")}};

function resetBuild(){document.querySelectorAll("#buildProgress div").forEach(x=>x.className="");setNotice("buildResult","");$("buildState").textContent="Ready"}
$("buildName").oninput=()=>{if(!$("buildSlug").dataset.manual)$("buildSlug").value=$("buildName").value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,63)};$("buildSlug").oninput=()=>{$("buildSlug").dataset.manual="1"};
$("builderForm").onsubmit=async e=>{e.preventDefault();resetBuild();const goal=$("buildGoal").value.trim();if(!goal){setNotice("buildResult","Describe what Hercules should build.","bad");return}const btn=$("buildRun");btn.disabled=true;btn.textContent="Building…";$("buildState").textContent="Running Forge";const steps=[...document.querySelectorAll("#buildProgress div")];steps[0].className="active";try{const d=await fetchFn("hercules-forge-builder",{method:"POST",body:JSON.stringify({action:"build_deploy",name:$("buildName").value.trim(),slug:$("buildSlug").value.trim(),profile:$("buildProfile").value,goal})});steps.forEach(x=>x.className="done");if(!d.liveVerification?.verified)steps[4].className="active";$("buildState").textContent=d.liveVerification?.verified?"Live and verified":"Deployed — verification pending";const url=d.deployment?.public_url||d.public_url||"";setNotice("buildResult",(d.liveVerification?.verified?"Build complete. ":"Build deployed. ")+(url?url:"No public URL returned."),d.liveVerification?.verified?"good":"warn");if(d.liveVerification?.verified)track("first_verified_useful_action",{surface:"forge_builder",project_id:project?.id||null});await loadDeployments()}catch(err){$("buildState").textContent="Build failed";setNotice("buildResult",err.message,"bad")}finally{btn.disabled=false;btn.textContent="Build & deploy"}};

async function ensureOrg(){
  if(orgId&&orgSlug)return orgId;
  const d=await fetchFn("hercules-status-controller/v1/me/organizations",{method:"GET"});
  const os=d.organizations||[];
  if(os.length){
    const x=os[0];
    orgId=x.organization_id||x.id||x.hercules_organizations?.id;
    orgSlug=x.hercules_organizations?.slug||null;
    if(orgId&&orgSlug)return orgId;
  }
  if(!user?.id)throw new Error("Authenticated user required.");
  const slug="hercules-"+user.id.replaceAll("-","").slice(0,12);
  let created=null;
  try{
    created=await fetchFn("hercules-launch",{method:"POST",body:JSON.stringify({action:"bootstrap_organization",org_name:"My Hercules",org_slug:slug})});
  }catch(error){
    const retry=await fetchFn("hercules-status-controller/v1/me/organizations",{method:"GET"});
    const ro=(retry.organizations||[])[0];
    if(ro){orgId=ro.organization_id||ro.id||ro.hercules_organizations?.id;orgSlug=ro.hercules_organizations?.slug||slug;return orgId}
    throw error;
  }
  orgId=created.organization_id;
  orgSlug=slug;
  return orgId;
}
function kpi(label,value){const x=document.createElement("div");x.className="card kpi";const s=document.createElement("span");s.className="muted";s.textContent=label;const b=document.createElement("b");b.textContent=safe(value);x.append(s,b);return x}
async function loadDeployments(){const list=$("deploymentList"),sum=$("deploymentSummary");list.textContent="";sum.textContent="";try{const oid=await ensureOrg();if(!oid)throw new Error("No active Hercules organization.");const d=await fetchFn("hercules-deploy",{method:"POST",body:JSON.stringify({action:"history",organization_id:oid})});const rows=d.deployments||[];sum.append(kpi("Releases",rows.length),kpi("Latest version",rows[0]?.version||"—"),kpi("Latest runtime",rows[0]?.metadata?.runtime||"—"));if(!rows.length){list.textContent="No deployments recorded yet.";return}for(const r of rows.slice(0,25)){const box=document.createElement("div");box.className="result deployrow";const left=document.createElement("div");const h=document.createElement("h3");h.textContent=(r.name||r.slug)+" · v"+safe(r.version);const p=document.createElement("p");p.textContent=safe(r.deployed_at)+" · "+safe(r.metadata?.runtime||r.metadata?.format);left.append(h,p);const a=document.createElement("a");a.className="btn small";a.textContent="Open";a.target="_blank";a.rel="noopener";a.href=r.public_url||"#";box.append(left,a);list.appendChild(box)}}catch(e){setNotice("deploymentList","Deployment history unavailable: "+e.message,"bad")}}
$("refreshDeployments").onclick=loadDeployments;

function statusRow(label,value,tone){const x=document.createElement("div");x.className="statusline";const a=document.createElement("span");a.textContent=label;const b=document.createElement("span");b.className="pill";const dot=document.createElement("span");dot.className="dot "+(tone||"");b.append(dot,document.createTextNode(safe(value)));x.append(a,b);return x}
async function loadStatus(){const cards=$("statusCards"),ctrl=$("controlStatus"),reg=$("registryStatus");cards.textContent="";ctrl.textContent="";reg.textContent="";const results=await Promise.allSettled([fetchFn("hercules-control-plane",{method:"GET"}),fetchFn("hercules-deployment-broker",{method:"GET"}),fetchFn("hercules-knowledge-registry",{method:"POST",body:JSON.stringify({action:"stats",org_slug:orgSlug})}),fetchFn("hercules-forge-builder",{method:"GET"})]);const c=results[0].status==="fulfilled"?results[0].value:null,b=results[1].status==="fulfilled"?results[1].value:null,k=results[2].status==="fulfilled"?results[2].value:null,f=results[3].status==="fulfilled"?results[3].value:null;cards.append(kpi("Control plane",c?.ok?"Operational":"Unavailable"),kpi("Forge Builder",f?.ok?"Operational":"Unavailable"),kpi("Knowledge entries",k?.total??"Unavailable"));ctrl.append(statusRow("Service",c?.service||"unreachable",c?.ok?"good":"bad"),statusRow("Mode",c?.mode||"—",c?.ok?"good":"warn"),statusRow("Queued commands",c?.commandQueue?.queued??"—",c?.ok?"good":"warn"),statusRow("Running commands",c?.commandQueue?.running??"—",c?.ok?"good":"warn"),statusRow("Deployment broker",b?.ok?"reachable":"unreachable",b?.ok?"good":"bad"));reg.append(statusRow("Registry",k?.ok?"reachable":"unreachable",k?.ok?"good":"bad"),statusRow("Entries",k?.total??"—",k?.ok?"good":"warn"),statusRow("Forge service",f?.service||"unreachable",f?.ok?"good":"bad"));const healthy=Boolean(c?.ok&&k?.ok&&f?.ok);$("livePill").innerHTML="<span class='dot "+(healthy?"good":"warn")+"'></span>"+(healthy?"Core services live":"Partial status");}
$("refreshStatus").onclick=loadStatus;

async function bootApp(){const s=(await sb.auth.getSession()).data.session;if(!s){switchRoot("auth");return}user=s.user;switchRoot("app");try{await ensureOrg();await ensureProject();$("projectLabel").textContent=project.name;const pending=sessionStorage.getItem("hercules_pending_prompt");if(pending){$("chatPrompt").value=pending;sessionStorage.removeItem("hercules_pending_prompt")}await Promise.allSettled([loadRecovery(),loadMessages(),loadKnowledgeStats(),loadStatus()]);$("aiStatus").innerHTML="<span class='dot good'></span>AI workspace ready"}catch(e){$("aiStatus").innerHTML="<span class='dot bad'></span>Setup issue";addMessage("meta","Workspace setup issue: "+e.message);const list=$("recoveryLeads");if(list){list.textContent="";const x=document.createElement("div");x.className="notice bad";x.textContent="Recovery Desk unavailable: "+e.message;list.appendChild(x)}}}
sb.auth.onAuthStateChange((_e,s)=>{if(!s&&$("app").classList.contains("hidden")===false)switchRoot("landing")});
(async()=>{const s=(await sb.auth.getSession()).data.session;if(s){user=s.user;$("openHercules").textContent="Open Hercules"}switchRoot("landing")})();
</script>
</body>
</html>`.replaceAll("__URL__",U).replaceAll("__KEY__",K);

Deno.serve(async(req:Request)=>{
  const url=new URL(req.url);
  if(url.searchParams.get("password_defense_probe")==="compromised"){
    const check=await screenPasswordServer("Password123!");
    return Response.json({
      ok:check.ok===false&&check.error==="compromised_password",
      service:"hercules-launch",
      password_defense:"hercules-password-defense-v2",
      probe:"compromised_password_rejected",
      result:check
    },{status:200,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
  }
  if(url.searchParams.get("health")==="1"){
    return Response.json({ok:true,service:"hercules-launch",version:"1.8.0",product:"Hercules Revenue Recovery",presentation:"customer-recovery-workspace",registration:"manual-release-gated",controlled_pilot_open:true,paid_billing_active:false,public_account_registration_open:false,owned_runtime:true,marketing_tracking:true,pilot_intake:true,ad_studio:true});
  }
  if(req.method==="POST"){
    const len=Number(req.headers.get("content-length")||"0");
    if(len>16384)return Response.json({ok:false,error:"payload_too_large"},{status:413,headers:{"cache-control":"no-store"}});
    const body=await req.json().catch(()=>null);
    if(!body||typeof body!=="object")return Response.json({ok:false,error:"invalid_json"},{status:400,headers:{"cache-control":"no-store"}});
    const action=cleanText((body as any).action,64);
    try{
      if(action==="password_breach_check"){
        const password=typeof (body as any).password==="string"?(body as any).password:"";
        if(password.length<12||password.length>256)return Response.json({ok:false,error:"weak_password_length"},{status:400,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
        try{
          const breached=await compromisedPasswordCount(password);
          if(breached>0)return Response.json({ok:false,error:"compromised_password"},{status:422,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
          return Response.json({ok:true,safe:true},{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
        }catch{
          return Response.json({ok:false,error:"password_safety_unavailable"},{status:503,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
        }
      }
      if(action==="secure_signup"){
        const email=cleanText((body as any).email,254).toLowerCase(),password=String((body as any).password||"");
        if(!validEmail(email))return Response.json({ok:false,error:"invalid_email"},{status:400,headers:{"cache-control":"no-store"}});
        if(!password)return Response.json({ok:false,error:"password_required"},{status:400,headers:{"cache-control":"no-store"}});
        const result=await secureSignup(email,password);
        return Response.json(result.body,{status:result.status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
      }
      if(action==="secure_change_password"){
        const password=String((body as any).password||"");
        if(!password)return Response.json({ok:false,error:"password_required"},{status:400,headers:{"cache-control":"no-store"}});
        const result=await securePasswordChange(req,password,cleanText((body as any).nonce,128),String((body as any).current_password||""));
        return Response.json(result.body,{status:result.status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
      }
      if(action==="privacy_request"){
        if(cleanText((body as any).website,120))return Response.json({ok:true},{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
        const category=cleanText((body as any).category,64);
        const email=cleanText((body as any).email,254).toLowerCase();
        const message=cleanText((body as any).message,3000);
        if(!PRIVACY_REQUEST_CATEGORIES.has(category))return Response.json({ok:false,error:"invalid_request_type"},{status:400,headers:{"cache-control":"no-store"}});
        if(!validEmail(email))return Response.json({ok:false,error:"invalid_email"},{status:400,headers:{"cache-control":"no-store"}});
        if(message.length<10)return Response.json({ok:false,error:"request_details_required"},{status:400,headers:{"cache-control":"no-store"}});
        const recent=await recentPrivacyRequestCount(email);
        if(recent>=5)return Response.json({ok:false,error:"privacy_request_rate_limited"},{status:429,headers:{"cache-control":"no-store","retry-after":"3600"}});
        const reference=crypto.randomUUID();
        await restInsert("hercules_privacy_requests",{
          public_reference:reference,
          category,
          email,
          message,
          status:"new",
          requester_verified:false,
          metadata:{source:"hercules-launch-request-center",verification_required:true}
        });
        return Response.json({ok:true,reference},{status:201,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
      }
      if(action==="marketing_event"){
        const eventName=cleanText((body as any).event_name,96).toLowerCase();
        if(!PUBLIC_MARKETING_EVENTS.has(eventName))return Response.json({ok:false,error:"invalid_event"},{status:400,headers:{"cache-control":"no-store"}});
        const properties=safeMarketingProperties((body as any).properties);
        await restInsert("marketing_events",{event_name:eventName,event_source:"hercules-launch",url:properties.path,properties,occurred_at:new Date().toISOString()});
        return Response.json({ok:true},{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
      }
      if(action==="pilot_request"){
        if(cleanText((body as any).website,120))return Response.json({ok:true},{headers:{"cache-control":"no-store"}});
        const email=cleanText((body as any).email,254).toLowerCase();
        if(!validEmail(email))return Response.json({ok:false,error:"invalid_email"},{status:400,headers:{"cache-control":"no-store"}});
        const attribution=safeMarketingProperties((body as any).attribution);
        const source=attribution.source||"direct",medium=attribution.medium||"organic",campaign=attribution.campaign||"founding-pilot-organic-v1";
        if(!await existingPilot(email)){
          await restInsert("marketing_contacts",{email,first_name:cleanText((body as any).first_name,100)||null,source,medium,campaign,referrer:cleanText((body as any).referrer,500)||null,status:"lead",metadata:{company:cleanText((body as any).company,160)||null,role:cleanText((body as any).role,100)||null,scope:"controlled-us-b2b-receivables",consent_version:"pilot-request-v1",attribution_id:attribution.attribution_id,content:attribution.content}});
        }
        await restInsert("marketing_events",{event_name:"pilot_request",event_source:"hercules-launch",url:"/pilot",properties:{...attribution,source,medium,campaign,surface:"pilot"},occurred_at:new Date().toISOString()});
        return Response.json({ok:true,accepted:true},{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
      }
      if(action==="bootstrap_organization"){
        const user=await authenticatedUser(req);
        if(!user)return Response.json({error:"authenticated_user_required"},{status:401,headers:{"cache-control":"no-store"}});
        const orgName=String((body as any)?.org_name||"").trim();
        const orgSlug=String((body as any)?.org_slug||"").trim();
        if(!orgName||orgName.length>120||!/^\w/.test(orgName)){
          return Response.json({error:"valid_organization_name_required"},{status:400,headers:{"cache-control":"no-store"}});
        }
        if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(orgSlug)){
          return Response.json({error:"valid_organization_slug_required"},{status:400,headers:{"cache-control":"no-store"}});
        }
        const organizationId=await serviceRpc("hercules_bootstrap_organization_internal",{p_user_id:user.id,org_name:orgName,org_slug:orgSlug});
        return Response.json({ok:true,organization_id:organizationId},{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
      }
      return Response.json({ok:false,error:"unsupported_action"},{status:400,headers:{"cache-control":"no-store"}});
    }catch(error){
      const code=action==="bootstrap_organization"?"organization_bootstrap_failed":"storage_error";
      return Response.json({ok:false,error:code,detail:error instanceof Error?error.message:"unknown"},{status:action==="bootstrap_organization"?409:503,headers:{"cache-control":"no-store"}});
    }
  }
  if(req.method!=="GET")return Response.json({error:"method_not_allowed"},{status:405});
  return new Response(html,{headers:{
    "content-type":"text/html; charset=utf-8",
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    "x-frame-options":"DENY",
    "referrer-policy":"no-referrer",
    "permissions-policy":"camera=(), microphone=(), geolocation=()",
    "content-security-policy":"default-src 'self'; script-src 'self' 'unsafe-inline' https://esm.sh; style-src 'self' 'unsafe-inline'; connect-src 'self' https://xbwuablxhhwsaoomsoco.supabase.co wss://xbwuablxhhwsaoomsoco.supabase.co https://esm.sh; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  }});
});