import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const U=Deno.env.get("SUPABASE_URL")!;
const S=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const db=createClient(U,S,{auth:{persistSession:false}});
const KEY="tax-identity-reconciliation";
const ORG="ea5fb196-67f9-42fa-b592-49eeb3b84346";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    "referrer-policy":"no-referrer"
  }
});

async function sha256(value:string){
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

async function authorized(req:Request){
  const key=req.headers.get("x-hercules-internal-key")||"";
  if(!key)return false;
  const digest=await sha256(key);
  const {data}=await db.from("hercules_internal_service_keys")
    .select("key_sha256,enabled")
    .eq("purpose","agent-coordinator")
    .eq("enabled",true)
    .maybeSingle();
  return Boolean(data?.enabled&&data.key_sha256===digest);
}

async function getSecret(id:string){
  const {data,error}=await db.rpc("hercules_get_secret",{p_id:id});
  if(error||!data)throw new Error("stripe_secret_unavailable");
  return String(data);
}

async function stripeAccount(key:string){
  const response=await fetch("https://api.stripe.com/v1/account",{
    headers:{authorization:"Bearer "+key},
    signal:AbortSignal.timeout(15000)
  });
  const text=await response.text();
  let body:any={};
  try{body=JSON.parse(text)}catch{}
  if(!response.ok)throw new Error("stripe_account_unavailable");
  return body;
}

function evaluate(current:any,account:any){
  const value=current?.value||{};
  const stateLegalName=String(value.stateLegalName||"").trim();
  const irsRecordName=String(value.irsRecordName||"").trim();
  const providerLegalName=String(account?.company?.name||account?.business_profile?.name||"").trim();
  const errors=Array.isArray(account?.requirements?.errors)?account.requirements.errors:[];
  const hasStripeTaxMismatch=errors.some((e:any)=>String(e?.code||"")==="verification_failed_tax_id_match");

  if(!stateLegalName){
    return {status:"blocked",decision:"missing_state_legal_name",reason:"missing_state_legal_name",writesAllowed:false};
  }
  if(providerLegalName!==stateLegalName){
    return {
      status:"blocked",
      decision:"provider_legal_name_mismatch",
      reason:"provider_legal_name_mismatch",
      writesAllowed:false,
      stateLegalName,
      providerLegalName
    };
  }
  if(irsRecordName!==stateLegalName){
    return {
      status:"blocked",
      decision:"owner_identity_decision_required",
      reason:"irs_record_not_issued_to_llc",
      writesAllowed:false,
      stateLegalName,
      providerLegalName,
      irsRecordName
    };
  }
  if(hasStripeTaxMismatch){
    return {
      status:"blocked",
      decision:"matching_irs_evidence_required",
      reason:"verification_failed_tax_id_match",
      writesAllowed:false,
      stateLegalName,
      providerLegalName
    };
  }
  return {
    status:"active",
    decision:"identity_evidence_aligned",
    reason:null,
    writesAllowed:true,
    stateLegalName,
    providerLegalName
  };
}

async function run(){
  const {data:current,error:currentError}=await db.from("hercules_continuity_ledger")
    .select("key,category,status,value,provenance,verified_at")
    .eq("key",KEY)
    .maybeSingle();
  if(currentError||!current)throw new Error("tax_identity_evidence_missing");

  const {data:connection,error:connectionError}=await db.from("hercules_provider_connections")
    .select("account_key,status,access_secret_ref,metadata,updated_at")
    .eq("organization_id",ORG)
    .eq("provider","stripe")
    .eq("status","active")
    .not("access_secret_ref","is",null)
    .order("updated_at",{ascending:false})
    .limit(1)
    .maybeSingle();
  if(connectionError||!connection?.access_secret_ref)throw new Error("stripe_connection_missing");

  const secret=await getSecret(String(connection.access_secret_ref));
  const account=await stripeAccount(secret);
  const result=evaluate(current,account);

  const nextValue={
    ...current.value,
    providerLegalName:result.providerLegalName||null,
    decision:result.decision,
    reason:result.reason,
    writesAllowed:result.writesAllowed,
    providerAccountMatches:Boolean(connection.account_key&&String(connection.account_key)===String(account?.id||"")),
    providerChargesEnabled:account?.charges_enabled===true,
    providerPayoutsEnabled:account?.payouts_enabled===true,
    providerTaxRequirementPresent:Array.isArray(account?.requirements?.currently_due)&&account.requirements.currently_due.includes("company.tax_id"),
    providerTaxMismatch:Array.isArray(account?.requirements?.errors)&&account.requirements.errors.some((e:any)=>String(e?.code||"")==="verification_failed_tax_id_match"),
    fullTaxIdentifierStored:false,
    checkedAt:new Date().toISOString()
  };

  const {error:updateError}=await db.from("hercules_continuity_ledger")
    .update({
      status:result.status,
      value:nextValue,
      provenance:"Hercules Vault redacted evidence + live Stripe account observation; full tax identifier intentionally excluded",
      verified_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    })
    .eq("key",KEY);
  if(updateError)throw updateError;

  return {
    ok:true,
    status:result.status,
    decision:result.decision,
    reason:result.reason,
    writesAllowed:result.writesAllowed,
    stripe:{
      accountMatch:nextValue.providerAccountMatches,
      chargesEnabled:nextValue.providerChargesEnabled,
      payoutsEnabled:nextValue.providerPayoutsEnabled,
      taxRequirementPresent:nextValue.providerTaxRequirementPresent,
      taxMismatch:nextValue.providerTaxMismatch
    },
    evidence:{
      stateLegalName:nextValue.stateLegalName,
      irsRecordName:nextValue.irsRecordName,
      irsTaxIdLast4:nextValue.irsTaxIdLast4,
      providerLegalName:nextValue.providerLegalName,
      fullTaxIdentifierStored:false
    }
  };
}

Deno.serve(async(req:Request)=>{
  if(req.method==="GET")return json({
    ok:true,
    service:"hercules-tax-identity-bridge",
    version:"1.0.0",
    fullTaxIdentifierStored:false,
    mode:"fail-closed"
  });
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  if(!await authorized(req))return json({error:"internal_authorization_required"},403);
  try{
    return json(await run());
  }catch(error){
    return json({
      ok:false,
      status:"blocked",
      error:"tax_identity_reconciliation_failed",
      detail:error instanceof Error?error.message:"unknown"
    },502);
  }
});
