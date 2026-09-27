import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hercules Integrations</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#080808;color:#f5f5f5;font-family:system-ui,-apple-system,Segoe UI,sans-serif}.wrap{max-width:880px;margin:auto;padding:22px}.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.brand{font-weight:900;letter-spacing:.14em}.card{background:#141414;border:1px solid #303030;border-radius:18px;padding:18px;margin-top:16px}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.input{width:100%;background:#090909;color:#fff;border:1px solid #3a3a3a;border-radius:11px;padding:12px;font-size:16px;margin-top:8px}.btn{border:1px solid #3a3a3a;background:#202020;color:#fff;border-radius:11px;padding:11px 14px;font-weight:750;cursor:pointer}.primary{background:#fff;color:#080808}.muted{color:#aaa}.hidden{display:none}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all}.status{white-space:pre-wrap;background:#0b0b0b;border-radius:10px;padding:12px;margin-top:10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:720px){.grid{grid-template-columns:1fr}.wrap{padding:14px}}</style></head><body><main class="wrap">
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
<section class="card"><h2>Launch Readiness</h2><p class="muted">One production view of the paid plan, MAIN theme, anchor hoodie, Online Store + Shop publication, launch collections, navigation, and final custom-domain gate.</p><div class="row"><button id="launchstatus" class="btn primary">Refresh launch readiness</button></div><div id="launchout" class="status"></div></section>
</div></section></main>
<script type="module">
import{createClient}from'https://esm.sh/@supabase/supabase-js@2.57.4';
const U='https://xbwuablxhhwsaoomsoco.supabase.co',K='sb_publishable_wB9FvOqAi-JhUQuJrHvczg_C_V4RgCt',ORG='ea5fb196-67f9-42fa-b592-49eeb3b84346',sb=createClient(U,K,{auth:{persistSession:true,autoRefreshToken:true}}),$=x=>document.getElementById(x);
let user=null,forgeReady=false;const show=(id,v)=>$(id).classList.toggle('hidden',!v);async function token(){return(await sb.auth.getSession()).data.session?.access_token||''}
async function call(slug,body){const t=await token();if(!t)throw Error('Sign in required');const r=await fetch(U+'/functions/v1/'+slug,{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+t,'apikey':K},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||d.detail||('HTTP '+r.status));return d}
function fmt(x){return JSON.stringify(x,null,2)}
async function boot(){const s=(await sb.auth.getSession()).data.session;user=s?.user||null;show('auth',!user);show('app',!!user);show('signout',!!user);if(user){await Promise.allSettled([driveStatus(),forgeStatus(),spaceshipStatus(),domainStatus(),shopifyStatus(),launchReadinessStatus()])}}
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
async function launchReadinessStatus(){try{$('launchout').textContent=fmt(await call('hercules-provider-connect',{action:'shopify_launch_status'}))}catch(e){$('launchout').textContent='Launch: '+e.message}}
$('shopstatus').onclick=shopifyStatus;
$('launchstatus').onclick=launchReadinessStatus;
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