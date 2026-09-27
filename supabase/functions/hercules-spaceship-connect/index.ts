import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const U = Deno.env.get("SUPABASE_URL") || "";
const P = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
const K = P.default || Deno.env.get("SUPABASE_ANON_KEY") || "";
const A = Deno.env.get("SUPABASE_ANON_KEY") || K;
const S =
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "";
const admin = createClient(U, S, {auth:{persistSession:false}});

const DOMAIN = "sauceapproved.com";
const SHOPIFY_STORE = "azymhc-x0.myshopify.com";
const API = "https://spaceship.dev/api/v1";
const ORG = "ea5fb196-67f9-42fa-b592-49eeb3b84346";
const DOMAIN_ID = "0e589dc2-7e0b-404a-94f5-109f94a9eec4";

const DESIRED = [
  {type:"A", name:"@", address:"23.227.38.65", ttl:3600},
  {type:"AAAA", name:"@", address:"2620:0127:f00f:5::", ttl:3600},
  {type:"CNAME", name:"www", cname:"shops.myshopify.com", ttl:3600},
];

const J = {
  "content-type":"application/json; charset=utf-8",
  "cache-control":"no-store",
  "x-content-type-options":"nosniff",
  "referrer-policy":"no-referrer",
};
const json = (body:unknown, status=200) => new Response(JSON.stringify(body), {status,headers:J});

async function auth(req:Request) {
  const authorization = req.headers.get("authorization") || "";
  if (!authorization) return null;
  const db = createClient(U, A, {
    auth:{persistSession:false},
    global:{headers:{Authorization:authorization}},
  });
  const {data:{user},error} = await db.auth.getUser();
  if (error || !user) return null;
  const {data:membership} = await db
    .from("hercules_memberships")
    .select("organization_id,role,status")
    .eq("organization_id",ORG)
    .eq("user_id",user.id)
    .eq("status","active")
    .in("role",["owner","admin"])
    .maybeSingle();
  return membership ? {user,membership} : null;
}

async function storeSecret(value:string, name:string, description:string) {
  const {data,error} = await admin.rpc("hercules_store_secret", {
    p_value:value,
    p_name:name,
    p_description:description,
  });
  if (error || !data) throw new Error("secret_store_failed");
  return String(data);
}

async function readSecret(id:unknown) {
  if (!id) throw new Error("provider_secret_missing");
  const {data,error} = await admin.rpc("hercules_get_secret", {p_id:String(id)});
  if (error || !data) throw new Error("provider_secret_unavailable");
  return String(data);
}

function keyOf(r:any) {
  return String(r?.type || "").toUpperCase() + ":" + String(r?.name || "").toLowerCase();
}
function valueOf(r:any) {
  return String(r?.type || "").toUpperCase() === "CNAME"
    ? String(r?.cname || "").replace(/\.$/,"").toLowerCase()
    : String(r?.address || "").toLowerCase();
}
function groupOf(r:any) {
  if (r?.group && typeof r.group === "object") return String(r.group.type || "");
  return typeof r?.group === "string" ? r.group : "unknown";
}
function compactRecord(r:any) {
  const type = String(r?.type || "").toUpperCase();
  const base:any = {type,name:String(r?.name || "")};
  if (type === "CNAME") base.cname = String(r?.cname || "").replace(/\.$/,"");
  else base.address = String(r?.address || "");
  return base;
}
function plan(records:any[]) {
  const desiredByKey = new Map(DESIRED.map((r) => [keyOf(r),r]));
  const deletes:any[] = [];
  const blockers:any[] = [];
  for (const r of records) {
    const target = desiredByKey.get(keyOf(r));
    if (!target || valueOf(r) === valueOf(target)) continue;
    const group = groupOf(r);
    if (group === "custom") deletes.push(compactRecord(r));
    else blockers.push({key:keyOf(r),group});
  }
  const saves = DESIRED.filter((target) =>
    !records.some((r) => keyOf(r) === keyOf(target) && valueOf(r) === valueOf(target))
  );
  return {deletes,blockers,saves,ready:deletes.length===0&&blockers.length===0&&saves.length===0};
}

async function shipRequest(apiKey:string, apiSecret:string, path:string, init:RequestInit = {}) {
  const response = await fetch(API + path, {
    ...init,
    headers:{
      "X-API-Key":apiKey,
      "X-API-Secret":apiSecret,
      ...(init.headers || {}),
    },
    signal:AbortSignal.timeout(30000),
  });
  const text = await response.text();
  let body:any = null;
  if (text) {
    try { body = JSON.parse(text); }
    catch { body = {detail:text.slice(0,800)}; }
  }
  if (!response.ok) throw new Error("spaceship_http_" + response.status);
  return body;
}

async function listRecords(apiKey:string, apiSecret:string) {
  const items:any[] = [];
  const take = 500;
  for (let skip=0; skip<10000; skip+=take) {
    const qs = new URLSearchParams({take:String(take),skip:String(skip),orderBy:"type"});
    const body = await shipRequest(apiKey,apiSecret,"/dns/records/" + DOMAIN + "?" + qs);
    const page = Array.isArray(body?.items) ? body.items : [];
    const total = Number(body?.total);
    if (!Number.isFinite(total) || total < 0) throw new Error("spaceship_invalid_dns_total");
    items.push(...page);
    if (items.length >= total) return items;
    if (!page.length) throw new Error("spaceship_dns_pagination_incomplete");
  }
  throw new Error("spaceship_dns_record_limit_exceeded");
}

async function connection() {
  const {data,error} = await admin
    .from("hercules_provider_connections")
    .select("id,provider,account_key,status,secret_ref,access_secret_ref,connected_at,last_error,metadata")
    .eq("organization_id",ORG)
    .eq("provider","spaceship")
    .eq("account_key",DOMAIN)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function audit(userId:string, action:string, metadata:any = {}) {
  await admin.from("hercules_audit_log").insert({
    organization_id:ORG,
    actor_user_id:userId,
    action,
    resource_type:"domain",
    resource_id:DOMAIN_ID,
    metadata:{domain:DOMAIN,target:SHOPIFY_STORE,...metadata},
  });
}

async function statusPayload() {
  const conn = await connection();
  const {data:domain} = await admin
    .from("hercules_domains")
    .select("domain_name,status,verified_at,ssl_status,primary_target_type,primary_target_id,metadata")
    .eq("id",DOMAIN_ID)
    .maybeSingle();
  const {data:records} = await admin
    .from("hercules_domain_dns_records")
    .select("record_type,name,value,ttl,status,last_verified_at")
    .eq("domain_id",DOMAIN_ID)
    .order("record_type");
  return {
    configured:Boolean(conn?.status === "active" && conn?.secret_ref && conn?.access_secret_ref),
    connection:conn ? {
      provider:conn.provider,
      account_key:conn.account_key,
      status:conn.status,
      connected_at:conn.connected_at,
      last_error:conn.last_error,
      metadata:conn.metadata,
    } : null,
    domain,
    desired_records:records || [],
  };
}

const html = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect Spaceship · Hercules</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#08090b;color:#f4f5f7;font:16px system-ui,-apple-system,"Segoe UI",sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(720px,100%);background:#121317;border:1px solid #2b2e35;border-radius:22px;padding:28px;box-shadow:0 24px 80px #0008}.tag{text-transform:uppercase;letter-spacing:.16em;color:#9298a4;font-size:12px}h1{font-size:34px;margin:10px 0}p{color:#b6bbc5;line-height:1.55}.grid{display:grid;gap:12px;margin-top:22px}label{font-size:13px;color:#c9cdd5}input{width:100%;padding:13px 14px;border:1px solid #353944;background:#0b0c0f;color:#fff;border-radius:12px;font-size:16px}button,a.btn{border:1px solid #3c414b;background:#f2f4f7;color:#08090b;border-radius:12px;padding:12px 15px;font-weight:800;cursor:pointer;text-decoration:none;display:inline-flex;justify-content:center}button.secondary,a.secondary{background:#1a1c21;color:#fff}.row{display:flex;gap:10px;flex-wrap:wrap}.notice{margin-top:16px;padding:12px;border-radius:12px;border:1px solid #353944;background:#0d0f12;white-space:pre-wrap}.good{border-color:#326b48}.bad{border-color:#7c3e3e}.muted{font-size:13px;color:#8e949f}.hidden{display:none}</style></head>
<body><main class="card">
<div class="tag">Hercules · Owner connection</div><h1>Connect Spaceship DNS</h1>
<p>This secure page connects <b>sauceapproved.com</b> to the SauceApproved Shopify store. The API secret is sent directly to Hercules over HTTPS, stored server-side, and cleared from this page after submission.</p>
<div id="auth" class="notice">Checking your Hercules owner session…</div>
<div id="form" class="grid hidden">
<label>Spaceship API key<input id="key" autocomplete="off" spellcheck="false"></label>
<label>Spaceship API secret<input id="secret" type="password" autocomplete="new-password" spellcheck="false"></label>
<div class="muted">Use a Spaceship API key limited to DNS records read + write. Do not grant billing, purchase, transfer, or account-security permissions.</div>
<div class="row"><button id="connect">Securely connect</button><button class="secondary" id="apply" disabled>Apply Shopify DNS</button></div>
</div>
<div id="status" class="notice hidden"></div>
<div class="row" style="margin-top:16px"><a class="btn secondary" href="/functions/v1/hercules-launch">Back to Hercules</a></div>
</main>
<script>
const K=__PUBLISHABLE_KEY__,storageKey="sb-xbwuablxhhwsaoomsoco-auth-token";
function token(){try{const x=JSON.parse(localStorage.getItem(storageKey)||"null");return x?.access_token||x?.currentSession?.access_token||""}catch{return""}}
function show(el,on=true){el.classList.toggle("hidden",!on)}
async function call(body){const t=token();if(!t)throw new Error("Sign in to Hercules first.");const r=await fetch(location.href,{method:"POST",headers:{"content-type":"application/json","apikey":K,"authorization":"Bearer "+t},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||d.error||("HTTP "+r.status));return d}
const auth=document.getElementById("auth"),form=document.getElementById("form"),status=document.getElementById("status"),apply=document.getElementById("apply");
async function refresh(){if(!token()){auth.textContent="Sign in to Hercules first, then reopen this page.";return}auth.textContent="Owner session found.";show(form,true);try{const d=await call({action:"status"});apply.disabled=!d.configured;show(status,true);status.className="notice "+(d.configured?"good":"");status.textContent=d.configured?"Spaceship credentials are connected. DNS is ready for controlled reconciliation.":"Spaceship credentials are not connected yet."}catch(e){show(status,true);status.className="notice bad";status.textContent=e.message}}
document.getElementById("connect").onclick=async()=>{const api_key=document.getElementById("key").value.trim(),api_secret=document.getElementById("secret").value.trim();if(!api_key||!api_secret){status.textContent="Enter both the API key and secret.";show(status,true);return}status.className="notice";status.textContent="Validating and storing credentials…";show(status,true);try{await call({action:"configure",api_key,api_secret});document.getElementById("key").value="";document.getElementById("secret").value="";status.className="notice good";status.textContent="Spaceship connected. No credential was returned to the browser.";apply.disabled=false}catch(e){status.className="notice bad";status.textContent=e.message}};
apply.onclick=async()=>{apply.disabled=true;status.className="notice";status.textContent="Reconciling Shopify DNS safely…";try{const d=await call({action:"reconcile_shopify",replace_custom_conflicts:true});status.className="notice good";status.textContent=d.ready?"DNS verified for Shopify. Hercules can continue to Shopify domain verification.":"DNS action completed, but verification is still pending."}catch(e){status.className="notice bad";status.textContent=e.message}finally{apply.disabled=false}};
refresh();
</script></body></html>`.replace("__PUBLISHABLE_KEY__", JSON.stringify(K));

Deno.serve(async (req:Request) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("health") === "1") {
    return json({ok:true,service:"hercules-spaceship-connect",version:"1.0.0",domain:DOMAIN,store:SHOPIFY_STORE});
  }
  if (req.method === "GET") {
    return new Response(html, {
      headers:{
        "content-type":"text/html; charset=utf-8",
        "cache-control":"no-store",
        "x-content-type-options":"nosniff",
        "referrer-policy":"no-referrer",
        "content-security-policy":"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' https://xbwuablxhhwsaoomsoco.supabase.co; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      },
    });
  }
  if (req.method !== "POST") return json({error:"method_not_allowed"},405);

  const owner = await auth(req);
  if (!owner) return json({error:"owner_or_admin_required"},403);
  const body:any = await req.json().catch(()=>({}));
  const action = String(body.action || "status");

  if (action === "status") {
    try { return json(await statusPayload()); }
    catch { return json({error:"status_unavailable"},503); }
  }

  if (action === "configure") {
    const apiKey = String(body.api_key || "").trim();
    const apiSecret = String(body.api_secret || "").trim();
    if (apiKey.length < 8 || apiSecret.length < 8) return json({error:"valid_api_key_and_secret_required"},400);
    try {
      await listRecords(apiKey,apiSecret);
      const keyRef = await storeSecret(apiKey,"hercules_spaceship_api_key_"+ORG,"Spaceship DNS API key for SauceApproved");
      const secretRef = await storeSecret(apiSecret,"hercules_spaceship_api_secret_"+ORG,"Spaceship DNS API secret for SauceApproved");
      const {data:conn,error} = await admin.from("hercules_provider_connections").upsert({
        organization_id:ORG,
        provider:"spaceship",
        account_key:DOMAIN,
        secret_ref:keyRef,
        access_secret_ref:secretRef,
        status:"active",
        connected_at:new Date().toISOString(),
        last_error:null,
        metadata:{
          permissions:["dnsrecords:read","dnsrecords:write"],
          scope:"dns-only",
          domain:DOMAIN,
          target:SHOPIFY_STORE,
        },
        updated_at:new Date().toISOString(),
      },{onConflict:"organization_id,provider,account_key"})
      .select("provider,account_key,status,connected_at,metadata").single();
      if (error) throw error;
      await admin.from("hercules_domains").update({
        metadata:{
          source:"owner_purchase",
          connection_intent:"shopify",
          dns_adapter:"hercules-deploy/spaceship-dns.mjs",
          dns_adapter_status:"ready",
          external_authorization:"active",
          registrar:"spaceship",
        },
        updated_at:new Date().toISOString(),
      }).eq("id",DOMAIN_ID);
      await audit(owner.user.id,"domain.spaceship.connected",{permissions:["dnsrecords:read","dnsrecords:write"]});
      return json({ok:true,connection:conn});
    } catch (e) {
      const detail = e instanceof Error ? e.message : "spaceship_connect_failed";
      return json({error:"spaceship_connect_failed",detail},502);
    }
  }

  if (action === "reconcile_shopify") {
    try {
      const conn = await connection();
      if (!conn || conn.status !== "active") return json({error:"spaceship_not_connected"},428);
      const apiKey = await readSecret(conn.secret_ref);
      const apiSecret = await readSecret(conn.access_secret_ref);
      const before = await listRecords(apiKey,apiSecret);
      const p = plan(before);
      if (p.blockers.length) {
        await admin.from("hercules_provider_connections").update({
          last_error:"provider_managed_dns_conflict",
          updated_at:new Date().toISOString(),
        }).eq("id",conn.id);
        return json({error:"provider_managed_dns_conflict",conflicts:p.blockers},409);
      }
      if (p.deletes.length && body.replace_custom_conflicts !== true) {
        return json({error:"custom_dns_conflict_confirmation_required",conflicts:p.deletes},409);
      }
      if (p.deletes.length) {
        await shipRequest(apiKey,apiSecret,"/dns/records/"+DOMAIN,{
          method:"DELETE",
          headers:{"content-type":"application/json"},
          body:JSON.stringify(p.deletes),
        });
      }
      if (p.saves.length) {
        await shipRequest(apiKey,apiSecret,"/dns/records/"+DOMAIN,{
          method:"PUT",
          headers:{"content-type":"application/json"},
          body:JSON.stringify({force:false,items:p.saves}),
        });
      }
      const after = await listRecords(apiKey,apiSecret);
      const verified = plan(after);
      if (!verified.ready) throw new Error("dns_verification_failed");

      const now = new Date().toISOString();
      for (const target of DESIRED) {
        const value = target.type === "CNAME" ? target.cname+"." : target.address;
        await admin.from("hercules_domain_dns_records").update({
          status:"active",
          last_verified_at:now,
          updated_at:now,
          metadata:{provider:"spaceship",verified:true},
        })
        .eq("domain_id",DOMAIN_ID)
        .eq("record_type",target.type)
        .eq("name",target.name)
        .eq("value",value);
      }
      await admin.from("hercules_domains").update({
        metadata:{
          source:"owner_purchase",
          connection_intent:"shopify",
          dns_adapter:"hercules-deploy/spaceship-dns.mjs",
          dns_adapter_status:"applied_verified",
          external_authorization:"active",
          registrar:"spaceship",
          dns_verified_at:now,
        },
        updated_at:now,
      }).eq("id",DOMAIN_ID);
      await admin.from("hercules_provider_connections").update({
        last_error:null,
        metadata:{
          permissions:["dnsrecords:read","dnsrecords:write"],
          scope:"dns-only",
          domain:DOMAIN,
          target:SHOPIFY_STORE,
          dns_verified_at:now,
        },
        updated_at:now,
      }).eq("id",conn.id);
      await audit(owner.user.id,"domain.shopify_dns.reconciled",{deleted:p.deletes.map(keyOf),saved:p.saves.map(keyOf),verified:true});
      return json({ok:true,ready:true,domain:DOMAIN,target:SHOPIFY_STORE,records:DESIRED});
    } catch (e) {
      const detail=e instanceof Error?e.message:"dns_reconcile_failed";
      return json({error:"dns_reconcile_failed",detail},502);
    }
  }

  return json({error:"unsupported_action"},400);
});
