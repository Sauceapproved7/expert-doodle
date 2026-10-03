import {createClient} from 'npm:@supabase/supabase-js@2';

const STUDIO_URL='https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-preview-cell/site/preview-sauceapproved-studio-global-20260928';
const ENTITLEMENT_VERSION='studio-shopify-founding-pilot-v1';
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body:unknown,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
  });
}
function normalizeEmail(value:unknown){
  const email=String(value??'').trim().toLowerCase();
  if(!email||email.length>254||!EMAIL.test(email))throw new Error('invalid_email');
  return email;
}
async function sha256Hex(value:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}

export function isStudioAccessPage(url:URL){
  return url.searchParams.get('studio_access')==='1';
}

export function studioAccessPage(ctx:{U:string;K:string}){
  const cfg=JSON.stringify({url:ctx.U,key:ctx.K,studioUrl:STUDIO_URL}).replace(/</g,'\\u003c');
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SauceApproved Studio Access</title>
<style>
:root{color-scheme:dark;--ink:#f7f4ee;--muted:#a6a29a;--line:#2d2b28;--gold:#e7b85b;--ember:#d8663b;--panel:#11110f}
*{box-sizing:border-box}html{background:#050505}body{margin:0;min-height:100vh;color:var(--ink);font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:radial-gradient(circle at 78% -10%,#43210f 0,transparent 34%),radial-gradient(circle at 10% 20%,#24200f 0,transparent 30%),linear-gradient(145deg,#050505,#0b0a08 56%,#050505);overflow-x:hidden}
body:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.16;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:64px 64px;mask-image:linear-gradient(to bottom,#000,transparent 75%)}
.wrap{width:min(1120px,100%);margin:auto;padding:clamp(24px,5vw,64px) clamp(18px,4vw,42px);position:relative}
.top{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:clamp(42px,7vw,86px)}
.brand{font-weight:950;letter-spacing:.14em;font-size:13px}.brand b{color:var(--gold)}.statuschip{display:flex;align-items:center;gap:8px;border:1px solid #34312c;background:#0c0c0bcf;border-radius:999px;padding:8px 12px;color:#c7c1b6;font-size:11px;font-weight:800;letter-spacing:.08em}.statuschip i{width:7px;height:7px;border-radius:50%;background:#80d69a;box-shadow:0 0 16px #80d69a}
.shell{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(340px,.85fr);gap:clamp(24px,5vw,70px);align-items:center}
.eyebrow{color:var(--gold);font-size:11px;font-weight:900;letter-spacing:.2em;text-transform:uppercase;margin-bottom:16px}.hero h1{font-size:clamp(52px,8vw,92px);line-height:.9;letter-spacing:-.06em;margin:0;max-width:700px}.hero h1 em{display:block;font-style:normal;color:transparent;-webkit-text-stroke:1px #b9b2a6}.lead{max-width:650px;color:#b9b4aa;font-size:clamp(17px,2vw,21px);line-height:1.65;margin:28px 0 0}.rail{display:flex;gap:10px;flex-wrap:wrap;margin-top:30px}.rail span{border:1px solid #2c2a26;border-radius:999px;padding:8px 11px;color:#918c83;font-size:11px;font-weight:800;letter-spacing:.04em}
.card{position:relative;border:1px solid #38342e;border-radius:30px;background:linear-gradient(160deg,#171612ed,#0b0b0aed);padding:clamp(24px,4vw,38px);box-shadow:0 36px 100px #000b,inset 0 1px #ffffff0d;overflow:hidden}.card:before{content:"";position:absolute;width:180px;height:180px;border-radius:50%;right:-80px;top:-90px;background:#d96a3030;filter:blur(12px)}.cardnum{font-size:11px;letter-spacing:.18em;color:#777168;font-weight:900}.card h2{font-size:clamp(27px,4vw,38px);line-height:1.05;letter-spacing:-.035em;margin:34px 0 12px}.muted{color:var(--muted)}
form{margin-top:24px}label{display:block;color:#d4cfc5;font-size:12px;font-weight:850;letter-spacing:.06em;margin-bottom:8px}input,button,a.cta{width:100%;padding:15px 16px;border-radius:13px;font:inherit}input{border:1px solid #3a3731;background:#080807;color:#fff;outline:0;margin:0 0 11px;box-shadow:inset 0 1px 8px #0008}input:focus{border-color:#b68b43;box-shadow:0 0 0 3px #e7b85b16}button,a.cta{border:1px solid #f2c56e;background:linear-gradient(135deg,#f2c56e,#d9773e);color:#171009;font-weight:950;text-align:center;text-decoration:none;display:block;cursor:pointer;box-shadow:0 12px 32px #d8663b20}button:hover,a.cta:hover{filter:brightness(1.06);transform:translateY(-1px)}
.statebox{margin:16px 0 0;border-top:1px solid #2a2824;padding-top:16px;font-size:13px}.ok{color:#a7efbb}.err{color:#ffb9b0}.hidden{display:none}.foot{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-top:clamp(48px,8vw,90px);padding-top:18px;border-top:1px solid #211f1c;color:#6f6b64;font-size:11px;letter-spacing:.05em}
@media(max-width:820px){.top{margin-bottom:44px}.shell{grid-template-columns:1fr}.hero h1{font-size:clamp(50px,16vw,76px)}.card{border-radius:24px}.lead{font-size:17px}.statuschip{display:none}}
@media(prefers-reduced-motion:no-preference){.card{animation:rise .65s ease-out both}.hero{animation:rise .55s ease-out both}@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}}
</style></head>
<body><main class="wrap">
<header class="top"><div class="brand">SAUCEAPPROVED <b>/ HERCULES</b></div><div class="statuschip"><i></i> SECURE STUDIO GATE</div></header>
<div class="shell">
<section class="hero"><div class="eyebrow">Private production system</div><h1>Build different.<em>Move different.</em></h1><p class="lead">Your SauceApproved Studio workspace is protected behind verified Founding Pilot entitlement. One secure gate into the Hercules production floor.</p><div class="rail"><span>ISOLATED WORKSPACE</span><span>ENTITLEMENT VERIFIED</span><span>HERCULES OWNED</span></div></section>
<section class="card"><div class="cardnum">ACCESS / 01</div><h2>Activate your Founding Pilot</h2><p class="muted">Use the same email address used for your Shopify purchase. Hercules stores only an email hash in the entitlement ledger.</p>
<form id="request"><label for="email">CHECKOUT EMAIL</label><input id="email" type="email" autocomplete="email" required placeholder="you@example.com"><button type="submit">Send secure access link →</button></form>
<p id="state" class="muted statebox">A paid Studio purchase is required.</p>
<a id="open" class="cta hidden" href="#">Open SauceApproved Studio →</a></section>
</div><footer class="foot"><span>SAUCEAPPROVED STUDIO</span><span>SECURE ACCESS • FAIL-CLOSED • PRIVATE BY DEFAULT</span></footer></main>
<script type="module">
import{createClient}from"https://esm.sh/@supabase/supabase-js@2";
const cfg=${cfg},sb=createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}),state=document.getElementById("state"),form=document.getElementById("request"),open=document.getElementById("open");
async function claim(){
 const {data:{session}}=await sb.auth.getSession(); if(!session)return false;
 state.textContent="Verifying paid Studio entitlement…";
 const r=await fetch(location.pathname+location.search,{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+session.access_token},body:JSON.stringify({action:"studio_purchase_claim"})});
 const x=await r.json().catch(()=>({}));
 if(!r.ok||!x.ok){state.className="err";state.textContent=x.error==="email_entitlement_mismatch"?"No paid Studio entitlement matches this signed-in email. Use the email from checkout.":"Studio activation could not be completed.";return true}
 history.replaceState(null,"",location.pathname+"?studio_access=1");
 form.classList.add("hidden");state.className="ok";state.textContent="Studio access is active. Your isolated Hercules workspace is ready.";open.href=x.studioUrl||cfg.studioUrl;open.classList.remove("hidden");return true;
}
form.addEventListener("submit",async e=>{e.preventDefault();state.className="muted";state.textContent="Checking purchase eligibility…";const r=await fetch(location.pathname+location.search,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"studio_access_request",email:document.getElementById("email").value})});await r.json().catch(()=>({}));state.textContent="If this email matches an eligible Studio purchase, a secure sign-in link is on the way. Check your inbox.";});
await claim();
</script></body></html>`;
  return new Response(html,{status:200,headers:{
    'content-type':'text/html; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'x-content-type-options':'nosniff',
    'x-frame-options':'DENY',
    'referrer-policy':'no-referrer',
    'permissions-policy':'camera=(), microphone=(), geolocation=()',
    'content-security-policy':"default-src 'none'; script-src 'unsafe-inline' https://esm.sh; style-src 'unsafe-inline'; connect-src https://*.supabase.co https://esm.sh; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
  }});
}

function adminClient(ctx:{U:string;S:string}){
  return createClient(ctx.U,ctx.S,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}

export async function studioAccessRequest(body:any,ctx:{U:string;K:string;S:string}){
  let email:string;
  try{email=normalizeEmail(body?.email)}catch{return json({ok:true,instructionsSent:true})}
  const buyerEmailSha256=await sha256Hex(email);
  const admin=adminClient(ctx);
  const {data}=await admin.from('hercules_studio_purchase_entitlements')
    .select('id,status')
    .eq('buyer_email_sha256',buyerEmailSha256)
    .in('status',['paid_pending_claim','claimed'])
    .limit(1)
    .maybeSingle();
  if(!data)return json({ok:true,instructionsSent:true});

  const auth=createClient(ctx.U,ctx.K,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  await auth.auth.signInWithOtp({
    email,
    options:{
      shouldCreateUser:true,
      emailRedirectTo:ctx.U+'/functions/v1/hercules-launch?studio_access=1'
    }
  });
  return json({ok:true,instructionsSent:true});
}

export async function studioAccessClaim(req:Request,ctx:{U:string;K:string;S:string}){
  const authorization=req.headers.get('authorization')||'';
  const token=authorization.startsWith('Bearer ')?authorization.slice(7):'';
  if(!token)return json({ok:false,error:'authenticated_user_required'},401);

  const auth=createClient(ctx.U,ctx.K,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data:{user},error}=await auth.auth.getUser(token);
  if(error||!user?.id||!user?.email)return json({ok:false,error:'authenticated_user_required'},401);

  const buyerEmailSha256=await sha256Hex(normalizeEmail(user.email));
  const admin=adminClient(ctx);
  const {data:claim,error:claimError}=await admin.rpc('hercules_claim_studio_purchase',{
    p_user_id:user.id,
    p_email_sha256:buyerEmailSha256
  });
  if(claimError)return json({ok:false,error:'studio_claim_failed'},500);
  if(!claim?.ok){
    const code=String(claim?.error||'studio_claim_failed');
    if(code==='founder_organization_forbidden')return json({ok:false,error:code},403);
    if(code==='email_entitlement_mismatch')return json({ok:false,error:code},409);
    return json({ok:false,error:code},409);
  }

  // hercules_claim_studio_purchase transactionally writes hercules_organizations
  // and hercules_memberships while refusing founder slug "sauceapproved".
  return json({
    ok:true,
    access:{
      entitlementId:claim.entitlement_id,
      organizationId:claim.organization_id,
      productCode:claim.product_code,
      planCode:claim.plan_code||'founding-pilot',
      entitlementVersion:claim.entitlement_version||ENTITLEMENT_VERSION,
      reused:claim.reused===true
    },
    studioUrl:STUDIO_URL
  });
}
