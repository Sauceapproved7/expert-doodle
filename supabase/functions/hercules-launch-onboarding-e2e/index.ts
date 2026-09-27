import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const U=Deno.env.get("SUPABASE_URL")!;
const A=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}").default||Deno.env.get("SUPABASE_ANON_KEY")||"";
const S=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const admin=createClient(U,S,{auth:{persistSession:false}});
const out=(b:unknown,s=200)=>Response.json(b,{status:s,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const enc=new TextEncoder();
const sha=async(s:string)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s)))].map(x=>x.toString(16).padStart(2,"0")).join("");
async function authorized(req:Request){
 const nonce=req.headers.get("x-hercules-e2e-nonce")||""; if(!nonce)return false;
 const digest=await sha(nonce),now=new Date().toISOString();
 const {data:row}=await admin.from("hercules_forge_e2e_nonces").select("id").eq("token_sha256",digest).is("used_at",null).gt("expires_at",now).maybeSingle();
 if(!row)return false;
 const {error}=await admin.from("hercules_forge_e2e_nonces").update({used_at:now}).eq("id",row.id).is("used_at",null);
 return !error;
}
async function call(path:string,token:string,init:RequestInit={}){
 const r=await fetch(U+"/functions/v1/"+path,{...init,headers:{...(init.headers||{}),"authorization":"Bearer "+token,"apikey":A,"content-type":"application/json"},signal:AbortSignal.timeout(20000)});
 const txt=await r.text();let body:any={};try{body=txt?JSON.parse(txt):{}}catch{body={raw:txt.slice(0,1200)}}return{ok:r.ok,status:r.status,body};
}
Deno.serve(async(req:Request)=>{
 if(req.method==="GET")return out({ok:true,service:"hercules-launch-onboarding-e2e",version:"1.0.2"});
 if(req.method!=="POST")return out({error:"method_not_allowed"},405);
 if(!await authorized(req))return out({error:"one_time_authorization_required"},403);
 const stamp=crypto.randomUUID().replaceAll("-","").slice(0,12);
 const email="hercules-onboard-"+stamp+"@example.com",password="Hq!"+crypto.randomUUID()+"9z",slug="hercules-"+stamp;
 let uid="",orgId="",projectId="";
 try{
   const {data:created,error:ce}=await admin.auth.admin.createUser({email,password,email_confirm:true});
   if(ce||!created.user)throw new Error("user_create_failed:"+(ce?.message||"unknown"));uid=created.user.id;
   const client=createClient(U,A,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data:session,error:se}=await client.auth.signInWithPassword({email,password});
   const token=session.session?.access_token||"";if(se||!token)throw new Error("signin_failed:"+(se?.message||"missing_session"));
   const before=await call("hercules-status-controller/v1/me/organizations",token,{method:"GET"});if(!before.ok)throw new Error("pre_org_list_failed:"+before.status);
   const boot=await admin.rpc("hercules_bootstrap_organization_internal",{p_user_id:uid,org_name:"Hercules QA Workspace",org_slug:slug});if(boot.error||!boot.data)throw new Error("bootstrap_failed:"+(boot.error?.message||"missing_org"));orgId=String(boot.data);
   const after=await call("hercules-status-controller/v1/me/organizations",token,{method:"GET"});if(!after.ok)throw new Error("post_org_list_failed:"+after.status);
   const rows=after.body?.organizations||[],membership=rows.find((x:any)=>String(x.organization_id||x.id||x.hercules_organizations?.id)===orgId);
   if(!membership)throw new Error("membership_missing_after_bootstrap");
   const orgSlug=String(membership.hercules_organizations?.slug||"");if(orgSlug!==slug)throw new Error("workspace_slug_mismatch");
   const p=await client.from("hercules_projects").insert({user_id:uid,name:"Hercules Command",goal:"Launch onboarding QA"}).select("id").single();
   if(p.error||!p.data?.id)throw new Error("project_create_failed:"+(p.error?.message||"missing_project"));projectId=String(p.data.id);
   const ai=await call("hercules-ai",token,{method:"POST",body:JSON.stringify({projectId,prompt:"Reply QA_READY only."})});if(!ai.ok||!String(ai.body?.result||"").trim())throw new Error("ai_failed:"+ai.status);
   const knowledge=await call("hercules-knowledge-registry",token,{method:"POST",body:JSON.stringify({action:"stats",org_slug:slug})});if(!knowledge.ok||knowledge.body?.ok!==true)throw new Error("knowledge_failed:"+knowledge.status);
   const forge=await call("hercules-forge-builder",token,{method:"GET"});if(!forge.ok||forge.body?.ok!==true)throw new Error("forge_access_failed:"+forge.status);
   const history=await call("hercules-deploy",token,{method:"POST",body:JSON.stringify({action:"history",organization_id:orgId})});if(!history.ok||history.body?.ok!==true)throw new Error("history_failed:"+history.status);
   const qaAddress="0x1111111111111111111111111111111111111111";
   const walletRegister=await call("hercules-wallet",token,{method:"POST",body:JSON.stringify({action:"register",organization_id:orgId,address:qaAddress,label:"Wallet QA",vault_mode:"external"})});
   if(!walletRegister.ok||!walletRegister.body?.account?.id)throw new Error("wallet_register_failed:"+walletRegister.status);
   const walletAccountId=String(walletRegister.body.account.id);

   const walletState=await call("hercules-wallet?organization_id="+encodeURIComponent(orgId),token,{method:"GET"});
   if(!walletState.ok||walletState.body?.mainnet_locked!==true||walletState.body?.mode!=="testnet_only")throw new Error("wallet_state_safety_failed:"+walletState.status);

   const secretProbe=await call("hercules-wallet",token,{method:"POST",body:JSON.stringify({action:"register",organization_id:orgId,address:qaAddress,private_key:"0x"+"11".repeat(32)})});
   if(secretProbe.status!==400||secretProbe.body?.error!=="private_key_material_rejected")throw new Error("wallet_secret_rejection_failed:"+secretProbe.status);

   const spender="3333333333333333333333333333333333333333";
   const max="f".repeat(64);
   const approvalData="0x095ea7b3"+spender.padStart(64,"0")+max;
   const unlimited=await call("hercules-wallet",token,{method:"POST",body:JSON.stringify({
     action:"review",organization_id:orgId,account_id:walletAccountId,chain_id:11155111,
     to_address:"0x2222222222222222222222222222222222222222",value_wei:"0",data:approvalData,
     simulation:{success:true,source:"client_should_be_ignored"}
   })});
   if(!unlimited.ok||unlimited.body?.review?.policy_decision!=="block"||unlimited.body?.review?.risk_level!=="blocked")throw new Error("wallet_unlimited_approval_not_blocked:"+unlimited.status);
   if(unlimited.body?.simulation_authority!=="server")throw new Error("wallet_simulation_not_server_authoritative");

   const blockedBroadcast=await call("hercules-wallet",token,{method:"POST",body:JSON.stringify({
     action:"record_broadcast",organization_id:orgId,review_id:unlimited.body.review.id,tx_hash:"0x"+"44".repeat(32)
   })});
   if(blockedBroadcast.status!==403||blockedBroadcast.body?.error!=="blocked_review_cannot_broadcast")throw new Error("wallet_blocked_broadcast_gate_failed:"+blockedBroadcast.status);

   const mainnet=await call("hercules-wallet",token,{method:"POST",body:JSON.stringify({
     action:"review",organization_id:orgId,account_id:walletAccountId,chain_id:1,
     to_address:"0x5555555555555555555555555555555555555555",value_wei:"0",data:"0x"
   })});
   if(!mainnet.ok||mainnet.body?.review?.policy_decision!=="block")throw new Error("wallet_mainnet_not_blocked:"+mainnet.status);

   const {data:sub}=await admin.from("hercules_subscriptions").select("plan_code,status,trial_ends_at").eq("organization_id",orgId).maybeSingle();
   const proof={signedIn:true,organizationsBefore:Number(before.body?.organizations?.length||0),workspaceProvisioned:Boolean(orgId),membershipActive:Boolean(membership),workspaceSlug:orgSlug,projectCreated:Boolean(projectId),aiOk:true,aiProvider:ai.body?.provider||null,knowledgeOk:true,knowledgeEntries:Number(knowledge.body?.total||0),forgeAccessible:true,deploymentHistoryAccessible:true,starterTrial:Boolean(sub&&sub.plan_code==="starter"&&sub.status==="trialing"),wallet:{registered:true,testnetOnly:true,mainnetLocked:true,privateKeyRejected:true,unlimitedApprovalBlocked:true,blockedBroadcastRejected:true,serverSimulationAuthoritative:true}};
   return out({ok:true,proof},200);
 }catch(e){return out({ok:false,error:e instanceof Error?e.message:"unknown"},500)}
 finally{
   if(projectId)await admin.from("hercules_projects").delete().eq("id",projectId);
   if(orgId)await admin.from("hercules_organizations").delete().eq("id",orgId);
   if(uid){await admin.from("profiles").delete().eq("user_id",uid);await admin.from("hercules_billing").delete().eq("user_id",uid);await admin.auth.admin.deleteUser(uid).catch(()=>null)}
 }
});