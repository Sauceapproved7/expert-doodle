import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hercules Integrations</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#080808;color:#f5f5f5;font-family:system-ui,-apple-system,Segoe UI,sans-serif}.wrap{max-width:880px;margin:auto;padding:22px}.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.brand{font-weight:900;letter-spacing:.14em}.card{background:#141414;border:1px solid #303030;border-radius:18px;padding:18px;margin-top:16px}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.input{width:100%;background:#090909;color:#fff;border:1px solid #3a3a3a;border-radius:11px;padding:12px;font-size:16px;margin-top:8px}.btn{border:1px solid #3a3a3a;background:#202020;color:#fff;border-radius:11px;padding:11px 14px;font-weight:750;cursor:pointer}.primary{background:#fff;color:#080808}.muted{color:#aaa}.hidden{display:none}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all}.status{white-space:pre-wrap;background:#0b0b0b;border-radius:10px;padding:12px;margin-top:10px}.launch-summary{display:grid;gap:8px;margin-top:10px}.launch-line{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;background:#0b0b0b;border:1px solid #292929;border-radius:10px;padding:10px}.launch-key{color:#aaa}.launch-value{font-weight:800;text-align:right}.pass{color:#b7f7c7}.wait{color:#f4d58d}.fail{color:#ffb0b0}details{margin-top:10px}summary{cursor:pointer;color:#aaa}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:720px){.grid{grid-template-columns:1fr}.wrap{padding:14px}}</style></head><body><main class="wrap">
<div class="top"><div><div class="brand">HERCULES</div><div class="muted">SauceApproved · Owned Integrations</div></div><button id="signout" class="btn hidden">Sign out</button></div>
<section id="auth" class="card"><h2>Sign in</h2><input id="email" class="input" type="email" placeholder="Email"><input id="password" class="input" type="password" placeholder="Password"><button id="signin" class="btn primary" style="margin-top:10px">Sign in</button><div id="authmsg" class="status hidden"></div></section>
<section id="app" class="hidden">
<div class="card"><b>Owned backend</b><p class="muted">These integrations run in your Supabase Hercules project. AppDeploy is not used.</p></div>
<div class="grid">
<section class="card"><h2>Google Drive</h2><p class="muted">Read-only Hercules Knowledge Vault with OAuth Authorization Code + PKCE S256.</p><div class="mono muted">Callback: https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-drive/callback</div><input id="gid" class="input" placeholder="Google OAuth Client ID"><input id="gsecret" class="input" type="password" placeholder="Google OAuth Client Secret"><div class="row" style="margin-top:10px"><button id="gsave" class="btn">Save client</button><button id="gconnect" class="btn primary">Connect Drive</button><button id="gstatus" class="btn">Status</button></div><div id="gout" class="status"></div></section>
<section class="card"><h2>Expert Doodle GitHub Bridge</h2><p class="muted">Dedicated Hercules GitHub App bridge. GitHub grants only Contents write access to the repository you choose during installation. Verification writes only to <span class="mono">hercules/expert-doodle-write</span>; main and proprietary Hercules source are not modified.</p><input id="ghrepo" class="input" value="Sauceapproved7/expert-doodle" readonly><div class="row" style="margin-top:10px"><button id="ghconnect" class="btn primary">Connect GitHub App</button><button id="ghpre" class="btn">Preflight</button><button id="ghwrite" class="btn" disabled>Harmless write test</button></div><div id="ghout" class="status"></div></section>
<section class="card"><h2>Spaceship DNS</h2><p class="muted">Secure SauceApproved DNS connection. Create a Spaceship API key with only <span class="mono">dnsrecords:read</span> and <span class="mono">dnsrecords:write</span>. The API secret is shown once by Spaceship.</p><div class="row"><a class="btn" href="https://www.spaceship.com/application/api-manager/" target="_blank" rel="noopener noreferrer">Open Spaceship API Manager</a></div><input id="shipkey" class="input" autocomplete="off" placeholder="Spaceship API Key"><input id="shipsecret" class="input" type="password" autocomplete="new-password" placeholder="Spaceship API Secret"><div class="row" style="margin-top:10px"><button id="shipsave" class="btn primary">Save DNS credentials + continue launch</button><button id="shipstatus" class="btn">Status</button></div><div id="shipout" class="status"></div></section>
<section class="card"><h2>Production Domain</h2><p class="muted"><span class="mono">sauceapproved.com</span> → Shopify. Status reads live DNS. Once Spaceship credentials are saved, Hercules can reconcile only the required Shopify web-routing records while preserving unrelated DNS.</p><div class="row"><button id="domainstatus" class="btn">Refresh launch status</button><button id="domainreconcile" class="btn primary">Run DNS reconcile</button></div><div id="domainout" class="status"></div></section>
<section class="card"><h2>Shopify Direct</h2><p class="muted">First-party Hercules Shopify connection for production webhooks plus automatic <span class="mono">sauceapproved.com</span> attachment/SSL/primary-state monitoring. The connection is locked to Shop GID <span class="mono">gid://shopify/Shop/100002726208</span>.</p><input id="shopclient" class="input" autocomplete="off" placeholder="Shopify Client ID"><input id="shopsecret" class="input" type="password" autocomplete="new-password" placeholder="Shopify Client Secret"><div class="row" style="margin-top:10px"><button id="shopsave" class="btn primary">Save Shopify connection + arm monitor</button><button id="shopstatus" class="btn">Domain status</button></div><div id="shopout" class="status"></div></section>
<section class="card"><h2>Stripe Direct</h2><p class="muted">Owner-controlled Hercules billing connection. Enter the Stripe secret key only here; Hercules validates the account, stores the key in Vault, and creates or reuses the webhook endpoint with webhook signing. Complete Stripe identity verification and payout-bank setup in Stripe before paid launch.</p><input id="stripekey" class="input" type="password" autocomplete="new-password" placeholder="Stripe Secret Key"><div class="row" style="margin-top:10px"><button id="stripesave" class="btn primary">Connect Stripe + webhook</button><button id="stripestatus" class="btn">Status</button></div><div id="stripeout" class="status"></div></section>
<section class="card"><h2>Personal Browser Bridge</h2><p class="muted">Pair one explicitly approved browser tab with Hercules. The bridge never exports passwords, cookies, OTP/MFA codes, provider session tokens, or CAPTCHA state.</p><div class="row"><button id="browserpair" class="btn primary">Create pairing token</button><button id="browserstatus" class="btn">Status</button></div><div id="browserout" class="status"></div></section>
<section class="card"><h2>Launch Readiness</h2><p class="muted">One production view of the live storefront and final custom-domain gate.</p><div class="row"><button id="launchstatus" class="btn primary">Refresh launch readiness</button></div><div id="launchsummary" class="launch-summary"></div><details><summary>Raw launch data</summary><div id="launchout" class="status"></div></details></section>
<section class="card"><h2>Storefront Smoke</h2><p class="muted">Read-only Hercules Browser verification of the live hoodie page, variant controls, and purchase controls. Runs hourly and automatically switches to <span class="mono">sauceapproved.com</span> after verified domain cutover.</p><div class="row"><button id="smokestatus" class="btn">Refresh smoke status</button><button id="smokerun" class="btn primary">Run smoke check now</button></div><div id="smokeout" class="status"></div></section>
<section class="card"><h2>Launch Decisions</h2><p class="muted">Owner-only decisions that Hercules must not make for you. Review the prepared launch documents, then approve only what you have actually decided. Authentication hardening remains system-evidence gated.</p><div class="row"><a class="btn" href="https://github.com/Sauceapproved7/expert-doodle/blob/main/docs/launch/HERCULES-PRICING-PROPOSAL.md" target="_blank" rel="noopener noreferrer">Pricing proposal</a><a class="btn" href="https://github.com/Sauceapproved7/expert-doodle/blob/main/docs/launch/HERCULES-TERMS-OF-SERVICE-DRAFT.md" target="_blank" rel="noopener noreferrer">Terms draft</a><a class="btn" href="https://github.com/Sauceapproved7/expert-doodle/blob/main/docs/launch/HERCULES-PRIVACY-POLICY-DRAFT.md" target="_blank" rel="noopener noreferrer">Privacy draft</a><a class="btn" href="https://github.com/Sauceapproved7/expert-doodle/blob/main/docs/launch/HERCULES-AUTH-SECURITY-REVIEW-2026-09-27.md" target="_blank" rel="noopener noreferrer">Auth review</a></div><div id="decisionrows" class="launch-summary"></div><div class="row" style="margin-top:10px"><button id="decisionrefresh" class="btn">Refresh decisions</button></div><div id="decisionout" class="status"></div></section>
</div></section></main>
<script type="module">
import{createClient}from'https://esm.sh/@supabase/supabase-js@2.57.4';
const U='https://xbwuablxhhwsaoomsoco.supabase.co',K='sb_publishable_wB9FvOqAi-JhUQuJrHvczg_C_V4RgCt',ORG='ea5fb196-67f9-42fa-b592-49eeb3b84346',sb=createClient(U,K,{auth:{persistSession:true,autoRefreshToken:true}}),$=x=>document.getElementById(x);
let user=null,forgeReady=false;const show=(id,v)=>$(id).classList.toggle('hidden',!v);async function token(){return(await sb.auth.getSession()).data.session?.access_token||''}
async function call(slug,body){const t=await token();if(!t)throw Error('Sign in required');const r=await fetch(U+'/functions/v1/'+slug,{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+t,'apikey':K},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||d.detail||('HTTP '+r.status));return d}
function fmt(x){return JSON.stringify(x,null,2)}
function decisionState(status){return status==='approved'?'pass':status==='rejected'?'fail':'wait'}
function renderLaunchDecisions(d){
  const box=$('decisionrows');box.replaceChildren();
  const approvals=d?.approvals||{};
  for(const type of ['pricing','terms','privacy','auth_hardening']){
    const row=document.createElement('div');row.className='launch-line';
    const left=document.createElement('div');
    const title=document.createElement('div');title.className='launch-key';title.textContent=type.replace('_',' ');
    const current=document.createElement('div');current.className='launch-value '+decisionState(approvals[type]?.status);current.textContent=String(approvals[type]?.status||'pending').toUpperCase();
    left.append(title,current);
    const actions=document.createElement('div');actions.className='row';
    if(type!=='auth_hardening'){
      const approve=document.createElement('button');approve.className='btn primary';approve.textContent='Approve';
      approve.onclick=()=>decideLaunch(type,'approved');
      const reset=document.createElement('button');reset.className='btn';reset.textContent='Reset';
      reset.onclick=()=>decideLaunch(type,'pending');
      actions.append(approve,reset);
    }else{
      const note=document.createElement('div');note.className='muted';note.textContent='Requires verified leaked-password protection evidence';
      actions.append(note);
    }
    row.append(left,actions);box.append(row);
  }
  box.append(launchLine('General public registration',d?.publicRegistrationOpen?'OPEN':'HELD CLOSED',d?.publicRegistrationOpen?'pass':'wait'));
}
async function launchDecisionStatus(){
  try{
    const d=await call('hercules-private-bridge',{action:'launch_approval_status'});
    renderLaunchDecisions(d);$('decisionout').textContent=fmt(d);return d
  }catch(e){
    $('decisionrows').replaceChildren(launchLine('Decision status','UNAVAILABLE','fail'));
    $('decisionout').textContent='Launch decisions: '+e.message;throw e
  }
}
async function decideLaunch(type,decision){
  const verb=decision==='approved'?'APPROVE':'RESET';
  const phrase=verb+' '+type.replace('_',' ').toUpperCase();
  const confirmation=window.prompt('Type exactly: '+phrase);
  if(confirmation===null)return;
  try{
    const d=await call('hercules-private-bridge',{
      action:'launch_approval_decide',
      approval_type:type,
      decision,
      confirmation
    });
    $('decisionout').textContent=fmt(d);
    renderLaunchDecisions(d?.status||{});
    await launchReadinessStatus().catch(()=>{});
  }catch(e){
    $('decisionout').textContent='Launch decision: '+e.message;
  }
}

function launchLine(label,value,state=''){
  const row=document.createElement('div');row.className='launch-line';
  const k=document.createElement('div');k.className='launch-key';k.textContent=label;
  const v=document.createElement('div');v.className='launch-value '+state;v.textContent=value;
  row.append(k,v);return row;
}
function renderLaunchSummary(p){
  const box=$('launchsummary');box.replaceChildren();
  const readiness=p?.launchReadiness||{},g=readiness?.gates||{},cut=p?.shopifyCutover||{},cred=p?.credentialState||{},launch=p?.launch||{};
  const storefrontReady=Boolean(g.storefrontReady),storefrontVerified=readiness?.storefront_status==='verified',domainComplete=Boolean(g.domainComplete);
  const overall=storefrontReady&&storefrontVerified&&domainComplete?'READY':storefrontReady&&storefrontVerified?'READY EXCEPT DOMAIN':'BLOCKED';
  const overallState=overall==='READY'?'pass':overall==='READY EXCEPT DOMAIN'?'wait':'fail';
  const dnsReady=Boolean(launch?.readiness?.dnsReady);
  let next='No blocker detected';
  if(cred?.status!=='configured')next='Authorize Spaceship DNS with dnsrecords:read + dnsrecords:write';
  else if(!dnsReady)next='Automatic DNS reconcile / propagation';
  else if(cut?.stage!=='complete')next='Shopify custom-domain + SSL cutover';
  box.append(
    launchLine('Overall',overall,overallState),
    launchLine('Live storefront',storefrontVerified?'VERIFIED':'UNVERIFIED',storefrontVerified?'pass':'fail'),
    launchLine('Storefront gates',storefrontReady?'PASS':'FAIL',storefrontReady?'pass':'fail'),
    launchLine('Custom domain',domainComplete?'COMPLETE':String(cut?.stage||'waiting').toUpperCase(),domainComplete?'pass':'wait'),
    launchLine('Spaceship DNS',cred?.status==='configured'?'AUTHORIZED':'AUTHORIZATION NEEDED',cred?.status==='configured'?'pass':'wait'),
    launchLine('Next action',next,overall==='READY'?'pass':'wait')
  );
  if(readiness?.storefront_verified_at)box.append(launchLine('Storefront verified at',String(readiness.storefront_verified_at),'pass'));
}
async function boot(){const s=(await sb.auth.getSession()).data.session;user=s?.user||null;show('auth',!user);show('app',!!user);show('signout',!!user);if(user){await Promise.allSettled([driveStatus(),forgeStatus(),spaceshipStatus(),domainStatus(),shopifyStatus(),stripeStatus(),personalBrowserStatus(),launchReadinessStatus(),storefrontSmokeStatus(),launchDecisionStatus()])}}
$('signin').onclick=async()=>{const r=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(r.error){$('authmsg').textContent=r.error.message;show('authmsg',true)}};
$('signout').onclick=()=>sb.auth.signOut();
async function driveStatus(){try{$('gout').textContent=fmt(await call('hercules-drive',{action:'status'}))}catch(e){$('gout').textContent='Drive: '+e.message}}
$('gstatus').onclick=driveStatus;
$('gsave').onclick=async()=>{try{const d=await call('hercules-drive',{action:'configure_client',client_id:$('gid').value.trim(),client_secret:$('gsecret').value});$('gsecret').value='';$('gout').textContent=fmt(d)}catch(e){$('gout').textContent='Drive: '+e.message}};
$('gconnect').onclick=async()=>{try{const d=await call('hercules-drive',{action:'start',return_to:location.href.split('?')[0]});if(d.authorization_url)location.href=d.authorization_url;else $('gout').textContent=fmt(d)}catch(e){$('gout').textContent='Drive: '+e.message}};
async function forgeStatus(){try{const d=await call('hercules-forge',{action:'status'});$('ghout').textContent=fmt(d)}catch(e){$('ghout').textContent='Forge: '+e.message}}
$('ghconnect').onclick=async()=>{try{const d=await call('hercules-github-app',{action:'start'});const f=document.createElement('form');f.method='POST';f.action=d.action;const i=document.createElement('input');i.type='hidden';i.name='manifest';i.value=d.manifest;f.appendChild(i);document.body.appendChild(f);f.submit()}catch(e){$('ghout').textContent='GitHub App: '+e.message}};
$('ghpre').onclick=async()=>{try{const d=await call('hercules-forge',{action:'preflight',repository:'Sauceapproved7/expert-doodle'});forgeReady=!!d.readyForWriteTest;$('ghwrite').disabled=!forgeReady;$('ghout').textContent=fmt(d)}catch(e){forgeReady=false;$('ghwrite').disabled=true;$('ghout').textContent='Forge: '+e.message}};
$('ghwrite').onclick=async()=>{if(!forgeReady)return;try{const d=await call('hercules-forge',{action:'write_test',repository:'Sauceapproved7/expert-doodle'});$('ghout').textContent=fmt(d);forgeReady=false;$('ghwrite').disabled=true}catch(e){$('ghout').textContent='Forge: '+e.message}};
async function spaceshipStatus(){try{$('shipout').textContent=fmt(await call('hercules-private-bridge',{action:'spaceship_dns_status'}))}catch(e){$('shipout').textContent='Spaceship: '+e.message}}
async function domainStatus(){try{const d=await call('hercules-domains',{action:'production_status',organization_id:ORG});$('domainout').textContent=fmt(d);return d}catch(e){$('domainout').textContent='Domain: '+e.message;throw e}}
async function waitDns(requestId){for(let i=0;i<35;i++){await new Promise(r=>setTimeout(r,2000));const d=await call('hercules-domains',{action:'production_reconcile_result',organization_id:ORG,request_id:requestId});if(d?.result?.ready)return d.result}throw Error('DNS reconciliation is still processing')}
async function reconcileDomain(){const q=await call('hercules-domains',{action:'production_reconcile',organization_id:ORG,confirm_domain:'sauceapproved.com'});if(q?.already_ready){await domainStatus();return q}if(!q?.queued||!q?.request_id)throw Error('DNS reconcile was not queued');$('domainout').textContent='DNS reconciliation queued. Verifying provider result…';const result=await waitDns(q.request_id);$('domainout').textContent=fmt(result);await domainStatus();return result}
async function shopifyStatus(){try{$('shopout').textContent=fmt(await call('hercules-provider-connect',{action:'shopify_domain_status'}))}catch(e){$('shopout').textContent='Shopify: '+e.message}}
async function stripeStatus(){try{const d=await call('hercules-provider-connect',{action:'status'});const row=(d.connections||[]).find(x=>x.provider==='stripe');$('stripeout').textContent=fmt(row||{provider:'stripe',status:'not_connected'})}catch(e){$('stripeout').textContent='Stripe: '+e.message}}
async function personalBrowserCall(body){const t=await token();if(!t)throw Error('Sign in required');const r=await fetch(U+'/functions/v1/hercules-personal-browser-bridge',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+t,'apikey':K},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||d.detail||('HTTP '+r.status));return d}
async function personalBrowserStatus(){try{$('browserout').textContent=fmt(await personalBrowserCall({action:'owner_status'}))}catch(e){$('browserout').textContent='Personal Browser: '+e.message}}
async function launchReadinessStatus(){try{const d=await call('hercules-domains',{action:'production_status',organization_id:ORG});const p=d?.production||{};renderLaunchSummary(p);$('launchout').textContent=fmt(p)}catch(e){$('launchsummary').replaceChildren(launchLine('Launch status','UNAVAILABLE','fail'));$('launchout').textContent='Launch: '+e.message}}
async function storefrontSmokeStatus(){try{const d=await call('hercules-provider-connect',{action:'storefront_smoke_status'});$('smokeout').textContent=fmt(d)}catch(e){$('smokeout').textContent='Smoke: '+e.message}}
async function storefrontSmokeRun(){try{const d=await call('hercules-provider-connect',{action:'storefront_smoke_run'});$('smokeout').textContent=fmt(d);setTimeout(()=>storefrontSmokeStatus().catch(()=>{}),3000)}catch(e){$('smokeout').textContent='Smoke: '+e.message}}
$('shopstatus').onclick=shopifyStatus;
$('stripestatus').onclick=stripeStatus;
$('browserstatus').onclick=personalBrowserStatus;
$('browserpair').onclick=async()=>{try{const d=await personalBrowserCall({action:'create_pair'});$('browserout').textContent='One-time pairing token (expires '+d.expires_at+'):\n\n'+d.pair_token+'\n\nPaste this only into your Hercules Personal Browser Bridge extension.'}catch(e){$('browserout').textContent='Personal Browser: '+e.message}};
$('stripesave').onclick=async()=>{
  const key=$('stripekey').value.trim();
  if(!key){$('stripeout').textContent='Stripe: secret key required';return}
  try{
    const d=await call('hercules-provider-connect',{action:'configure_stripe',secret_key:key});
    $('stripekey').value='';
    $('stripeout').textContent=fmt(d);
    await stripeStatus();
  }catch(e){
    $('stripekey').value='';
    $('stripeout').textContent='Stripe: '+e.message;
  }
};
$('launchstatus').onclick=launchReadinessStatus;
$('smokestatus').onclick=storefrontSmokeStatus;
$('smokerun').onclick=storefrontSmokeRun;
$('decisionrefresh').onclick=launchDecisionStatus;
$('shopsave').onclick=async()=>{
  const clientId=$('shopclient').value.trim(),clientSecret=$('shopsecret').value.trim();
  if(!clientId||!clientSecret){$('shopout').textContent='Shopify: Client ID and Client Secret required';return}
  try{
    const d=await call('hercules-provider-connect',{action:'configure_shopify',client_id:clientId,client_secret:clientSecret});
    $('shopclient').value='';
    $('shopsecret').value='';
    $('shopout').textContent=fmt(d);
    await shopifyStatus();
    await launchReadinessStatus();
  }catch(e){
    $('shopclient').value='';
    $('shopsecret').value='';
    $('shopout').textContent='Shopify: '+e.message;
  }
};

$('shipstatus').onclick=spaceshipStatus;
$('domainstatus').onclick=domainStatus;
$('domainreconcile').onclick=async()=>{try{await reconcileDomain()}catch(e){$('domainout').textContent='Domain: '+e.message}};
$('shipsave').onclick=async()=>{const apiKey=$('shipkey').value.trim(),apiSecret=$('shipsecret').value.trim();if(!apiKey||!apiSecret){$('shipout').textContent='Spaceship: API key and secret required';return}try{const d=await call('hercules-private-bridge',{action:'configure_spaceship_dns',api_key:apiKey,api_secret:apiSecret});$('shipkey').value='';$('shipsecret').value='';$('shipout').textContent=fmt(d);await spaceshipStatus();await reconcileDomain()}catch(e){$('shipkey').value='';$('shipsecret').value='';$('shipout').textContent='Spaceship: '+e.message;await domainStatus().catch(()=>{})}};
sb.auth.onAuthStateChange(()=>boot());boot();
</script></body></html>`;

Deno.serve(()=>new Response(html,{status:200,headers:new Headers({
  'Content-Type':'text/html; charset=UTF-8',
  'Cache-Control':'no-store, no-cache, must-revalidate',
  'Pragma':'no-cache',
  'X-Frame-Options':'DENY',
  'Strict-Transport-Security':'max-age=31536000; includeSubDomains',
  'Referrer-Policy':'no-referrer',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline' https://esm.sh; style-src 'self' 'unsafe-inline'; connect-src 'self' https://xbwuablxhhwsaoomsoco.supabase.co wss://xbwuablxhhwsaoomsoco.supabase.co https://esm.sh; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://github.com"
})}));