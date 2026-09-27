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

const html = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#070707">
<meta name="description" content="Hercules by SauceApproved — your AI command system for asking, researching, building, deploying, and operating.">
<title>Hercules by SauceApproved</title>
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
.appgrid{display:grid;grid-template-columns:226px minmax(0,1fr);gap:18px;padding-top:22px}.sidebar{position:sticky;top:78px;align-self:start;padding:13px}.sidebtn{width:100%;justify-content:flex-start;margin:4px 0;background:transparent}.sidebtn.active{background:#f1f3f6;color:#070809;border-color:#f1f3f6}.workspace{min-width:0}.view{display:none}.view.active{display:block}.viewhead{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;margin-bottom:16px}.viewhead h1{font-size:clamp(32px,5vw,52px);letter-spacing:-.04em;margin:5px 0}.muted{color:var(--muted)}
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
  <nav class="navlinks" id="publicNav"><a class="btn ghost small" href="#capabilities">Capabilities</a><a class="btn ghost small" href="#system">System</a><button class="btn primary small" id="openHercules">Open Hercules</button></nav>
  <div class="row hidden" id="appActions"><span class="pill" id="livePill"><span class="dot"></span>Checking</span><button class="btn small" id="signOut">Sign out</button></div>
</header>

<section id="landing">
  <section class="hero">
    <div>
      <div class="tag">AI command system</div>
      <h1>HERCULES</h1>
      <div class="sub">Your AI command system.</div>
      <p>Ask. Research. Build. Deploy. Hercules brings intelligence, knowledge, execution, deployment, and system operations into one owned control surface.</p>
      <div class="row"><span class="pill">AI reasoning</span><span class="pill">Verified knowledge</span><span class="pill">Forge Builder</span><span class="pill">Hercules Wallet</span><span class="pill">Owned deployments</span></div>
    </div>
    <div class="commandbox">
      <div class="tag">Give Hercules a goal</div>
      <textarea id="heroPrompt" aria-label="Hercules goal" placeholder="Research a problem, build an app, prepare a deployment, or tell Hercules what you need done."></textarea>
      <div class="commandmeta"><span class="muted">Your prompt stays off the URL.</span><button class="btn primary" id="heroRun">Run with Hercules</button></div>
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

  <section class="section legal" id="privacy"><div class="tag">Early Access</div><h3>Privacy</h3><p>Hercules uses account identifiers, workspace content, prompts, build and deployment records, and audit data to operate the service, secure access, and improve reliability. Provider credentials remain server-side where supported. Do not submit data you are not authorized to use.</p></section>
  <section class="section legal" id="terms"><div class="tag">Early Access</div><h3>Terms</h3><p>Use Hercules only with systems and data you own or are authorized to operate. Early Access features, limits, and availability may change. Any paid production commitments, support levels, or warranties require separate written terms.</p></section>
  <footer class="footer"><span>Hercules by SauceApproved</span><span>Early Access · Privacy · Terms</span></footer>
</section>

<section id="auth" class="hidden">
  <div class="authwrap"><div class="panel authcard"><div class="tag">Secure access</div><h1 id="authTitle">Sign in</h1><input class="input" id="email" type="email" autocomplete="email" placeholder="Email"><input class="input" id="password" type="password" minlength="8" autocomplete="current-password" placeholder="Password"><button class="btn primary" style="width:100%;margin-top:12px" id="authSubmit">Sign in</button><button class="btn" style="width:100%;margin-top:8px" id="authSwitch">Create account</button><button class="btn ghost" style="width:100%;margin-top:8px" id="backHome">Back</button><div class="notice hidden" id="authMsg"></div></div></div>
</section>

<section id="app" class="hidden">
  <div class="appgrid">
    <aside class="panel sidebar">
      <button class="btn sidebtn active" data-view="homeView">Home / Chat</button>
      <button class="btn sidebtn" data-view="knowledgeView">Knowledge</button>
      <a class="btn sidebtn" href="/hercules-wallet/">Wallet · Testnet</a>
      <button class="btn sidebtn" data-view="builderView">Builder</button>
      <button class="btn sidebtn" data-view="forgeView">Forge / Deployments</button>
      <button class="btn sidebtn" data-view="statusView">System Status</button>
      <a class="btn sidebtn" href="https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-web" target="_blank" rel="noopener">Owner Console</a>
    </aside>
    <main class="workspace">
      <section class="view active" id="homeView">
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
$("openHercules").onclick=openProduct;$("systemOpen").onclick=openProduct;$("backHome").onclick=()=>switchRoot("landing");
$("heroRun").onclick=()=>{const p=$("heroPrompt").value.trim();if(p)sessionStorage.setItem("hercules_pending_prompt",p);openProduct()};

$("authSwitch").onclick=async()=>{if(authMode==="signin"&&!publicSignupOpen){const open=await refreshRegistrationState();if(!open){setNotice("authMsg","Public account creation is not open yet. Existing authorized users can sign in.","warn");return}}authMode=authMode==="signin"?"signup":"signin";$("authTitle").textContent=authMode==="signin"?"Sign in":"Create account";$("authSubmit").textContent=authMode==="signin"?"Sign in":"Create account";$("authSwitch").disabled=false;$("authSwitch").textContent=authMode==="signin"?(publicSignupOpen?"Create account":"Early access — sign-in only"):"Sign in instead";setNotice("authMsg","")};
$("authSubmit").onclick=async()=>{setNotice("authMsg","");if(authMode==="signup"&&!await refreshRegistrationState()){authMode="signin";$("authTitle").textContent="Sign in";$("authSubmit").textContent="Sign in";setNotice("authMsg","Public account creation is not open yet. Existing authorized users can sign in.","warn");return}const email=$("email").value.trim(),password=$("password").value;const q=authMode==="signin"?await sb.auth.signInWithPassword({email,password}):await sb.auth.signUp({email,password});if(q.error){setNotice("authMsg",q.error.message,"bad");return}if(authMode==="signup"&&!q.data.session){setNotice("authMsg","Check your email to confirm the account, then sign in.","good");return}await bootApp()};
$("signOut").onclick=async()=>{await sb.auth.signOut();user=null;project=null;orgId=null;orgSlug=null;switchRoot("landing")};

document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",async()=>{document.querySelectorAll("[data-view]").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===b.dataset.view));if(b.dataset.view==="knowledgeView")await loadKnowledgeStats();if(b.dataset.view==="forgeView")await loadDeployments();if(b.dataset.view==="statusView")await loadStatus()}));

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
$("builderForm").onsubmit=async e=>{e.preventDefault();resetBuild();const goal=$("buildGoal").value.trim();if(!goal){setNotice("buildResult","Describe what Hercules should build.","bad");return}const btn=$("buildRun");btn.disabled=true;btn.textContent="Building…";$("buildState").textContent="Running Forge";const steps=[...document.querySelectorAll("#buildProgress div")];steps[0].className="active";try{const d=await fetchFn("hercules-forge-builder",{method:"POST",body:JSON.stringify({action:"build_deploy",name:$("buildName").value.trim(),slug:$("buildSlug").value.trim(),profile:$("buildProfile").value,goal})});steps.forEach(x=>x.className="done");if(!d.liveVerification?.verified)steps[4].className="active";$("buildState").textContent=d.liveVerification?.verified?"Live and verified":"Deployed — verification pending";const url=d.deployment?.public_url||d.public_url||"";setNotice("buildResult",(d.liveVerification?.verified?"Build complete. ":"Build deployed. ")+(url?url:"No public URL returned."),d.liveVerification?.verified?"good":"warn");await loadDeployments()}catch(err){$("buildState").textContent="Build failed";setNotice("buildResult",err.message,"bad")}finally{btn.disabled=false;btn.textContent="Build & deploy"}};

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

async function bootApp(){const s=(await sb.auth.getSession()).data.session;if(!s){switchRoot("auth");return}user=s.user;switchRoot("app");try{await ensureOrg();await ensureProject();$("projectLabel").textContent=project.name;await loadMessages();const pending=sessionStorage.getItem("hercules_pending_prompt");if(pending){$("chatPrompt").value=pending;sessionStorage.removeItem("hercules_pending_prompt")}await Promise.allSettled([loadKnowledgeStats(),loadStatus()]);$("aiStatus").innerHTML="<span class='dot good'></span>AI workspace ready"}catch(e){$("aiStatus").innerHTML="<span class='dot bad'></span>Setup issue";addMessage("meta","Workspace setup issue: "+e.message)}}
sb.auth.onAuthStateChange((_e,s)=>{if(!s&&$("app").classList.contains("hidden")===false)switchRoot("landing")});
(async()=>{const s=(await sb.auth.getSession()).data.session;if(s){user=s.user;$("openHercules").textContent="Open Hercules"}switchRoot("landing")})();
</script>
</body>
</html>`.replaceAll("__URL__",U).replaceAll("__KEY__",K);

Deno.serve(async(req:Request)=>{
  const url=new URL(req.url);
  if(url.searchParams.get("health")==="1"){
    return Response.json({ok:true,service:"hercules-launch",version:"1.3.0",product:"Hercules",presentation:"launch-surface",registration:"manual-release-gated",owned_runtime:true,backend_rebuild:false});
  }

  if(req.method==="POST"){
    const user=await authenticatedUser(req);
    if(!user)return Response.json({error:"authenticated_user_required"},{status:401,headers:{"cache-control":"no-store"}});
    const body=await req.json().catch(()=>({}));
    if(String(body?.action||"")!=="bootstrap_organization"){
      return Response.json({error:"unsupported_action"},{status:400,headers:{"cache-control":"no-store"}});
    }
    const orgName=String(body?.org_name||"").trim();
    const orgSlug=String(body?.org_slug||"").trim();
    if(!orgName||orgName.length>120||!/^\w/.test(orgName)){
      return Response.json({error:"valid_organization_name_required"},{status:400,headers:{"cache-control":"no-store"}});
    }
    if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(orgSlug)){
      return Response.json({error:"valid_organization_slug_required"},{status:400,headers:{"cache-control":"no-store"}});
    }
    try{
      const organizationId=await serviceRpc("hercules_bootstrap_organization_internal",{
        p_user_id:user.id,
        org_name:orgName,
        org_slug:orgSlug
      });
      return Response.json({ok:true,organization_id:organizationId},{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
    }catch(error){
      return Response.json({error:"organization_bootstrap_failed",detail:error instanceof Error?error.message:"unknown"},{status:409,headers:{"cache-control":"no-store"}});
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