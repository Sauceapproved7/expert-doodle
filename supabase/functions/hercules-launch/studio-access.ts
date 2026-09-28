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
<style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#090909;color:#f5f5f5;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}.wrap{max-width:620px;margin:auto;padding:38px 18px}.brand{font-weight:900;letter-spacing:.1em}.card{margin-top:18px;border:1px solid #333;border-radius:18px;background:#151515;padding:24px}h1{font-size:28px;margin:.2em 0}.muted{color:#bbb}input,button,a.cta{width:100%;padding:14px;border-radius:11px;font:inherit}input{border:1px solid #444;background:#0d0d0d;color:#fff;margin:12px 0}button,a.cta{border:0;background:#fff;color:#111;font-weight:800;text-align:center;text-decoration:none;display:block}.ok{color:#bdf7ca}.err{color:#ffd0d0}.hidden{display:none}</style></head>
<body><main class="wrap"><div class="brand">SAUCEAPPROVED STUDIO</div><section class="card">
<h1>Activate your Founding Pilot</h1>
<p class="muted">Use the same email address used for your Shopify purchase. Hercules stores only an email hash in the entitlement ledger.</p>
<form id="request"><input id="email" type="email" autocomplete="email" required placeholder="Checkout email"><button type="submit">Send secure access link</button></form>
<p id="state" class="muted">A paid Studio purchase is required.</p>
<a id="open" class="cta hidden" href="#">Open SauceApproved Studio</a>
</section></main>
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
  const admin=adminClient(ctx);\n  const {data}=await admin.from('hercules_studio_purchase_entitlements')
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
  const admin=adminClient(ctx);\n  const {data:claim,error:claimError}=await admin.rpc('hercules_claim_studio_purchase',{
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
