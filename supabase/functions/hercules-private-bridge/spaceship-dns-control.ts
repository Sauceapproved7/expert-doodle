import {
  SHOPIFY_DNS_RECORDS,
  RESEND_MAIL_DNS_RECORDS,
  SpaceshipDnsClient,
  planShopifyDnsReconciliation,
  planResendMailDnsReconciliation,
} from "./spaceship-dns.mjs";

const U = Deno.env.get("SUPABASE_URL") || "";
const S =
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "";
const DOMAIN = "sauceapproved.com";
const ACTIONS = new Set([
  "inspect_shopify_dns",
  "reconcile_shopify_dns",
  "inspect_resend_mail_dns",
  "reconcile_resend_mail_dns",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type":"application/json; charset=utf-8",
      "cache-control":"no-store",
      "x-content-type-options":"nosniff",
      "referrer-policy":"no-referrer",
    },
  });
}

function adminHeaders(extra: Record<string,string> = {}) {
  return {
    apikey:S,
    authorization:"Bearer " + S,
    ...extra,
  };
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function internalAuthorized(req: Request) {
  const key = req.headers.get("x-hercules-internal-key") || "";
  if (!key) return false;

  const url = new URL(U + "/rest/v1/hercules_internal_service_keys");
  url.searchParams.set("purpose", "eq.spaceship-dns");
  url.searchParams.set("enabled", "eq.true");
  url.searchParams.set("select", "key_sha256,enabled");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {headers:adminHeaders()});
  if (!response.ok) return false;
  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  return Boolean(row?.enabled && row?.key_sha256 === await sha256(key));
}

async function rest(path: string, init: RequestInit = {}) {
  const response = await fetch(U + "/rest/v1/" + path, {
    ...init,
    headers:adminHeaders({
      ...(init.headers as Record<string,string> || {}),
    }),
  });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try { payload = JSON.parse(text); }
    catch { payload = {raw:text.slice(0, 2000)}; }
  }
  if (!response.ok) throw new Error("supabase_rest_failed:" + response.status);
  return payload;
}

async function secret(secretRef: string) {
  const payload = await rest("rpc/hercules_get_secret", {
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({p_id:secretRef}),
  });
  if (!payload) throw new Error("spaceship_credential_unavailable");
  return String(payload);
}

async function credentials() {
  const rows = await rest(
    "hercules_spaceship_dns_credentials?singleton=eq.true&status=eq.configured&select=api_key_secret_ref,api_secret_secret_ref&limit=1"
  ) as Array<{api_key_secret_ref?:string; api_secret_secret_ref?:string}>;

  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.api_key_secret_ref || !row?.api_secret_secret_ref) {
    throw new Error("spaceship_credentials_not_configured");
  }

  const [apiKey, apiSecret] = await Promise.all([
    secret(row.api_key_secret_ref),
    secret(row.api_secret_secret_ref),
  ]);
  return {apiKey, apiSecret};
}

async function mcpOauthConfigured(){
  const rows=await rest(
    "hercules_spaceship_mcp_oauth?singleton=eq.true&status=eq.configured&select=status&limit=1"
  ) as Array<{status?:string}>;
  return Array.isArray(rows)&&rows[0]?.status==="configured";
}

const MCP_DNS_ACTIONS={dns_records_get:"spaceship_mcp_dns_records_get",dns_records_save:"spaceship_mcp_dns_records_save",dns_records_delete:"spaceship_mcp_dns_records_delete"} as const;

async function mcpDns(req:Request,action:"dns_records_get"|"dns_records_save"|"dns_records_delete",args:any){
  const key=req.headers.get("x-hercules-internal-key")||"";
  if(!key)throw new Error("spaceship_dns_internal_secret_unavailable");
  const response=await fetch(U+"/functions/v1/hercules-private-bridge",{
    method:"POST",
    headers:{"content-type":"application/json","x-hercules-internal-key":key},
    body:JSON.stringify({action:MCP_DNS_ACTIONS[action],arguments:args}),
    signal:AbortSignal.timeout(30000)
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||payload?.ok!==true){
    throw new Error(String(payload?.error||"spaceship_mcp_dns_failed").slice(0,1000));
  }
  return payload.result||{};
}

function spaceshipMcpClient(req:Request){
  return {
    async listRecords(domain:string){
      const items:any[]=[]; const take=500;
      for(let skip=0;skip<10000;skip+=take){
        const page=await mcpDns(req,"dns_records_get",{domainName:domain,take,skip});
        const rows=Array.isArray(page?.items)?page.items:[];
        const total=Number(page?.total);
        if(!Number.isFinite(total)||total<0)throw new Error("Spaceship MCP DNS list total is invalid");
        items.push(...rows);
        if(items.length>=total)return {items,total};
        if(rows.length===0)throw new Error("Spaceship MCP DNS pagination ended before total");
      }
      throw new Error("Spaceship MCP DNS record limit exceeded");
    },
    async saveRecords(domain:string,records:any[],options:any={}){
      const result=await mcpDns(req,"dns_records_save",{domainName:domain,records,force:options?.force===true});
      return {saved:Number(result?.saved||records.length)};
    },
    async deleteRecords(domain:string,records:any[]){
      const result=await mcpDns(req,"dns_records_delete",{domainName:domain,records});
      return {deleted:Number(result?.deleted||records.length)};
    }
  };
}

async function providerClient(req:Request){
  if(await mcpOauthConfigured()){
    return {mode:"mcp_oauth",client:spaceshipMcpClient(req)};
  }
  try{
    let {apiKey,apiSecret}=await credentials();
    let client=new SpaceshipDnsClient({apiKey,apiSecret,allowedDomains:[DOMAIN],fetchImpl:fetch});

    try{
      await client.listRecords(DOMAIN);
      return {mode:"external_api",client};
    }catch(error:any){
      if(Number(error?.status)!==401)throw error;
    }

    const swapped=new SpaceshipDnsClient({
      apiKey:apiSecret,
      apiSecret:apiKey,
      allowedDomains:[DOMAIN],
      fetchImpl:fetch
    });

    try{
      await swapped.listRecords(DOMAIN);
    }catch(swappedError:any){
      if(Number(swappedError?.status)===401){
        throw new Error("spaceship_api_credentials_rejected");
      }
      throw swappedError;
    }

    const normalized=await rest("rpc/hercules_spaceship_dns_configure_credentials",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({p_api_key:apiSecret,p_api_secret:apiKey}),
    });
    if(normalized!==true)throw new Error("spaceship_credential_normalization_failed");

    apiKey=""; apiSecret="";
    return {mode:"external_api_normalized",client:swapped};
  }catch(error){
    if(error instanceof Error&&error.message==="spaceship_credentials_not_configured"){
      throw new Error("spaceship_mcp_authorization_required");
    }
    throw error;
  }
}

async function createRun(traceId: string, action: string, replaceCustomConflicts: boolean) {
  await rest("hercules_spaceship_dns_runs", {
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({
      trace_id:traceId,
      action,
      status:"running",
      domain:DOMAIN,
      replace_custom_conflicts:replaceCustomConflicts,
    }),
  });
}

async function finishRun(traceId: string, status: string, summary: unknown, error: string | null = null) {
  const query = new URLSearchParams({trace_id:"eq." + traceId});
  await rest("hercules_spaceship_dns_runs?" + query, {
    method:"PATCH",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({
      status,
      summary,
      error,
      completed_at:new Date().toISOString(),
    }),
  });
}

function managedRecord(record: Record<string,unknown>) {
  const type = String(record?.type || "").toUpperCase();
  const groupRaw = record?.group as Record<string,unknown> | string | undefined;
  const group = groupRaw && typeof groupRaw === "object"
    ? String(groupRaw.type || "unknown")
    : String(groupRaw || "unknown");
  const result: Record<string,unknown> = {
    type,
    name:String(record?.name || ""),
    group,
  };
  if (type === "CNAME") result.value=String(record?.cname || "");
  else if (type === "TXT") result.value=String(record?.value || "");
  else if (type === "MX") {
    result.value=String(record?.exchange || "");
    result.preference=Number(record?.preference);
  } else result.value=String(record?.address || "");
  return result;
}

function dnsConfig(action: string) {
  if (action === "inspect_resend_mail_dns" || action === "reconcile_resend_mail_dns") {
    return {
      desired:RESEND_MAIL_DNS_RECORDS,
      planner:planResendMailDnsReconciliation,
      label:"resend_mail",
    };
  }
  return {
    desired:SHOPIFY_DNS_RECORDS,
    planner:planShopifyDnsReconciliation,
    label:"shopify",
  };
}

function planSummary(
  plan: ReturnType<typeof planShopifyDnsReconciliation>,
  current: Record<string,unknown>[],
  desired: ReadonlyArray<Record<string,unknown>>,
  label: string,
) {
  const managedKeys = new Set(desired.map((record) =>
    String(record.type || "").toUpperCase() + ":" + String(record.name || "").toLowerCase()
  ));
  return {
    domain:DOMAIN,
    lane:label,
    ready:plan.ready,
    safeToApply:plan.safeToApply,
    desired,
    currentManaged:current
      .filter((record) => managedKeys.has(String(record.type || "").toUpperCase() + ":" + String(record.name || "").toLowerCase()))
      .map(managedRecord),
    customConflictCount:plan.deleteRecords.length,
    blockingConflicts:plan.blockingConflicts,
    missingCount:plan.saveRecords.length,
  };
}
export async function handleSpaceshipDnsRequest(req: Request) {
  if (req.method !== "POST") return json({error:"method_not_allowed"}, 405);
  if (!U || !S) return json({error:"runtime_configuration_missing"}, 503);
  if (!await internalAuthorized(req)) return json({error:"unauthorized"}, 401);

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");
  if (!ACTIONS.has(action)) return json({error:"unsupported_action"}, 400);

  const replaceCustomConflicts = body?.replaceCustomConflicts === true;
  const inspectAction = action.startsWith("inspect_");
  if (inspectAction && replaceCustomConflicts) {
    return json({error:"replace_flag_not_allowed_for_inspect"}, 400);
  }

  const traceId = crypto.randomUUID();
  await createRun(traceId, action, replaceCustomConflicts);

  try {
    const {client,mode} = await providerClient(req);
    const config=dnsConfig(action);
    const current = await client.listRecords(DOMAIN);
    const preflight = config.planner(current.items);
    const before = planSummary(preflight, current.items, config.desired, config.label);

    if (inspectAction) {
      const summary={...before,providerMode:mode};
      await finishRun(traceId, preflight.blockingConflicts.length ? "conflict" : "succeeded", summary);
      return json({ok:true, traceId, action, summary});
    }

    if (preflight.blockingConflicts.length) {
      const summary={...before,providerMode:mode};
      await finishRun(traceId, "conflict", summary, "provider_managed_or_unknown_conflict");
      return json({ok:false, traceId, error:"dns_conflict", summary}, 409);
    }

    if (preflight.deleteRecords.length && !replaceCustomConflicts) {
      const summary={...before,providerMode:mode};
      await finishRun(traceId, "conflict", summary, "custom_conflict_requires_explicit_replacement");
      return json({ok:false, traceId, error:"custom_conflict_requires_explicit_replacement", summary}, 409);
    }

    let deletedCount=0, savedCount=0;
    if(preflight.deleteRecords.length){
      const deleted=await client.deleteRecords(DOMAIN,preflight.deleteRecords);
      deletedCount=Number(deleted?.deleted||preflight.deleteRecords.length);
    }
    if(preflight.saveRecords.length){
      const saved=await client.saveRecords(DOMAIN,preflight.saveRecords,{force:false});
      savedCount=Number(saved?.saved||preflight.saveRecords.length);
    }

    const after = await client.listRecords(DOMAIN);
    const verification = config.planner(after.items);
    const summary = {
      ...planSummary(verification, after.items, config.desired, config.label),
      providerMode:mode,
      changed:Boolean(deletedCount||savedCount),
      deletedCount,
      savedCount,
      verified:verification.ready,
    };

    if (!summary.verified) throw new Error("spaceship_dns_post_write_verification_failed");

    await finishRun(traceId, "succeeded", summary);
    return json({ok:true, traceId, action, summary});
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 1000) : "spaceship_dns_failed";
    const status = ["spaceship_credentials_not_configured","spaceship_mcp_authorization_required"].includes(detail) ? 503 : 502;
    await finishRun(traceId, "failed", {domain:DOMAIN}, detail).catch(() => {});
    return json({ok:false, traceId, error:detail}, status);
  }
}
