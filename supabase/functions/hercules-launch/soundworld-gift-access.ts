import {createClient} from 'npm:@supabase/supabase-js@2';

const BRIDGE_PATH='/functions/v1/hercules-private-bridge?soundworld_launch_gift=1';
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body:unknown,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
      'x-content-type-options':'nosniff',
      'referrer-policy':'no-referrer'
    }
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

function adminClient(ctx:{U:string;S:string}){
  return createClient(ctx.U,ctx.S,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}

export function isSoundWorldGiftAccessPage(url:URL){
  return url.searchParams.get('soundworld_gift')==='1';
}

export function soundWorldGiftAccessPage(ctx:{U:string;K:string}){
  const cfg=JSON.stringify({
    url:ctx.U,
    key:ctx.K,
    bridgeUrl:ctx.U+BRIDGE_PATH,
    studioGiftUrl:'https://sauceapproved-studio.onrender.com/launch-gift'
  }).replace(/</g,'\\u003c');

  const html=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Claim Your SoundWorld Gift</title>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% 0,#2b2118 0,#0d0b09 34%,#040404 75%);color:#f7f7f7}
main{width:min(900px,100%);margin:auto;padding:clamp(18px,4vw,42px)}
a{color:#dcb9a1;text-decoration:none}
.hero,.panel{border:1px solid #3b3027;border-radius:24px;background:linear-gradient(145deg,#18120e,#090909)}
.hero{padding:clamp(24px,5vw,46px)}
.panel{margin-top:16px;padding:22px}
.eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#c99572}
h1{font-size:clamp(38px,8vw,68px);line-height:.95;letter-spacing:-.05em;margin:12px 0 18px}
h2{margin:0 0 10px}
p{color:#b9b9b9;line-height:1.6}
input,button{font:inherit;border-radius:12px}
input{width:100%;padding:14px;border:1px solid #444;background:#0d0d0d;color:#fff;margin:10px 0}
button{border:0;padding:13px 16px;background:#f4f4f4;color:#111;font-weight:850;cursor:pointer}
button:disabled{opacity:.45;cursor:not-allowed}
.hidden{display:none!important}
.msg{margin-top:14px;padding:13px 14px;border-radius:12px;background:#161616;color:#bbb}
.ok{border:1px solid #305e3b;background:#102015;color:#c9f7d2}
.err{border:1px solid #6a3232;background:#211010;color:#ffd1d1}
.eligibility{margin-top:14px;border:1px solid #2d2925;border-radius:16px;padding:16px;background:#0b0a09}
.meta{font-size:12px;color:#8e8e8e}
.choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}
.choice{background:#18130f;color:#f3ddc8;border:1px solid #5a4325;min-height:74px}
.choice strong{display:block}
.reserved{margin-top:12px;padding:14px;border:1px solid #305e3b;border-radius:12px;background:#102015;color:#c9f7d2}
@media(max-width:700px){.choices{grid-template-columns:1fr}}
</style>
</head>
<body>
<main>
<a id="back" href="#">← Hercules Launch Gift</a>
<section class="hero">
<div class="eyebrow">Hercules × SoundWorld</div>
<h1>Claim your free launch gift.</h1>
<p>Use the same email tied to your qualifying Hercules purchase. Hercules matches the signed-in buyer to verified payment evidence before a gift can be reserved.</p>
</section>
<section id="signin" class="panel">
<h2>Secure sign-in</h2>
<p>We’ll send a secure magic link only when this email matches an eligible Hercules purchase. No password is required.</p>
<form id="request"><input id="email" type="email" autocomplete="email" required placeholder="Email used at checkout"><button type="submit">Send secure claim link</button></form>
<div id="signinState" class="msg">A qualifying paid Hercules purchase is required.</div>
</section>
<section id="claim" class="panel hidden">
<h2>Your eligible purchases</h2>
<p>Each qualifying purchase can reserve one gift: SoundWorld Pods, SoundWorld Max, or the SoundWorld Portable Speaker.</p>
<div id="claimState" class="msg">Checking your verified purchases…</div>
<div id="purchases"></div>
</section>
</main>
<script type="module">
import{createClient}from"https://esm.sh/@supabase/supabase-js@2";
const cfg=${cfg};
const sb=createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const signin=document.getElementById("signin"),claim=document.getElementById("claim"),request=document.getElementById("request"),email=document.getElementById("email"),signinState=document.getElementById("signinState"),claimState=document.getElementById("claimState"),purchases=document.getElementById("purchases"),back=document.getElementById("back");
back.href=cfg.studioGiftUrl;

function setMessage(el,text,kind="msg"){el.className=kind;el.textContent=text}
function money(cents,currency){try{return new Intl.NumberFormat(undefined,{style:"currency",currency:currency||"USD"}).format((Number(cents)||0)/100)}catch{return "$"+((Number(cents)||0)/100).toFixed(2)}}
function choiceButton(label,code,purchaseKey,token){
 const b=document.createElement("button");b.type="button";b.className="choice";
 const strong=document.createElement("strong");strong.textContent=label;b.appendChild(strong);
 const span=document.createElement("span");span.textContent="$0 launch gift";b.appendChild(span);
 b.onclick=async()=>{for(const x of b.parentElement.querySelectorAll("button"))x.disabled=true;setMessage(claimState,"Locking your gift choice…","msg");
  const r=await fetch(cfg.bridgeUrl,{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+token},body:JSON.stringify({purchaseKey,giftCode:code})});
  const x=await r.json().catch(()=>({}));
  if(!r.ok||!x.ok){setMessage(claimState,x.error==="gift_already_reserved_for_purchase"?"This purchase already has a gift reserved.":"Gift reservation could not be completed.","msg err");for(const z of b.parentElement.querySelectorAll("button"))z.disabled=false;return}
  setMessage(claimState,"Your SoundWorld gift is reserved.","msg ok");await loadClaims(token);
 };
 return b;
}
function render(data,token){
 purchases.textContent="";
 const reservations=new Map((data.reservations||[]).map(r=>[String(r.purchase_key),r]));
 const eligible=Array.isArray(data.eligibility)?data.eligibility:[];
 if(!eligible.length){setMessage(claimState,"No qualifying Hercules purchase is linked to this signed-in email yet.","msg");return}
 setMessage(claimState,"Verified purchase found. Pick one gift for each eligible purchase.","msg ok");
 for(const item of eligible){
  const card=document.createElement("article");card.className="eligibility";
  const h=document.createElement("h3");h.textContent="Hercules purchase";card.appendChild(h);
  const meta=document.createElement("div");meta.className="meta";meta.textContent=(item.productCode||"Hercules")+" · "+money(item.amountCents,item.currency)+" · "+new Date(item.purchasedAt).toLocaleString();card.appendChild(meta);
  const existing=reservations.get(String(item.purchaseKey));
  if(existing){
   const r=document.createElement("div");r.className="reserved";r.textContent="Reserved: "+String(existing.gift_code||"SoundWorld gift").replaceAll("-"," ")+" · fulfillment begins after production availability.";card.appendChild(r);
  }else if(item.status==="eligible"){
   const choices=document.createElement("div");choices.className="choices";
   choices.appendChild(choiceButton("SoundWorld Pods","soundworld-pods",item.purchaseKey,token));
   choices.appendChild(choiceButton("SoundWorld Max","soundworld-max",item.purchaseKey,token));
   choices.appendChild(choiceButton("Portable Speaker","soundworld-portable-speaker",item.purchaseKey,token));
   card.appendChild(choices);
  }
  purchases.appendChild(card);
 }
}
async function loadClaims(token){
 const r=await fetch(cfg.bridgeUrl,{headers:{"authorization":"Bearer "+token}});
 const x=await r.json().catch(()=>({}));
 if(!r.ok||!x.ok){setMessage(claimState,"Could not load your gift eligibility.","msg err");return}
 render(x,token);
}
async function boot(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){signin.classList.remove("hidden");claim.classList.add("hidden");return}
 signin.classList.add("hidden");claim.classList.remove("hidden");
 await loadClaims(session.access_token);
}
request.addEventListener("submit",async e=>{
 e.preventDefault();setMessage(signinState,"Checking purchase eligibility…","msg");
 const r=await fetch(location.pathname+location.search,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"soundworld_gift_access_request",email:email.value})});
 await r.json().catch(()=>({}));
 setMessage(signinState,"If this email matches an eligible Hercules purchase, a secure claim link is on the way. Check your inbox.","msg ok");
});
await boot();
</script>
</body>
</html>`;

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

export async function soundWorldGiftAccessRequest(body:any,ctx:{U:string;K:string;S:string}){
  let email:string;
  try{email=normalizeEmail(body?.email)}catch{return json({ok:true,instructionsSent:true})}
  const buyerEmailSha256=await sha256Hex(email);
  const admin=adminClient(ctx);
  const {data}=await admin.from('hercules_soundworld_gift_eligibility')
    .select('purchase_key,status')
    .eq('buyer_email_sha256',buyerEmailSha256)
    .in('status',['eligible','claimed'])
    .limit(1)
    .maybeSingle();
  if(!data)return json({ok:true,instructionsSent:true});

  const auth=createClient(ctx.U,ctx.K,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  await auth.auth.signInWithOtp({
    email,
    options:{
      shouldCreateUser:true,
      emailRedirectTo:ctx.U+'/functions/v1/hercules-launch?soundworld_gift=1'
    }
  });
  return json({ok:true,instructionsSent:true});
}
