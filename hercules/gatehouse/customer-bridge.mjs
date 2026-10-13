/** First-party Gatehouse customer-data bridge via existing Supabase Auth and RLS.
 * No service-role key, no new Edge Function, no arbitrary URL fetch, no money movement.
 */
import {buildTenantSiteRow,publicAccountState,assessDelivery} from "./client-onboarding.mjs";
const BASE="https://xbwuablxhhwsaoomsoco.supabase.co";
const UID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function outcome(status,body){return {status,body}}
export function customerAccessBridge({enabled=false,reportsEnabled=false,publishableKey="",fetcher=fetch}={}){
 const hasKey=typeof publishableKey==="string"&&publishableKey.startsWith("sb_publishable_");
 const ready=enabled===true&&hasKey;
 const reportsReady=reportsEnabled===true&&hasKey;
 async function remote(path,method,token,body){
  const headers={"apikey":publishableKey,"authorization":"Bearer "+token,"accept":"application/json"};
  if(body!==undefined){headers["content-type"]="application/json";headers["prefer"]="return=representation"}
  const result=await fetcher(BASE+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:"error",signal:AbortSignal.timeout(10000)});
  if(!result.ok)return {ok:false,status:result.status};
  const data=await result.json();
  return {ok:true,data};
 }
 async function resolveUser(req){
  const header=req.headers.authorization;
  if(typeof header!=="string"||header.length>4096||!/^Bearer [A-Za-z0-9_.-]+$/.test(header))return null;
  const token=header.slice(7);
  const read=await remote("/auth/v1/user","GET",token);
  const user=read.ok?read.data:null;
  if(!user||typeof user.id!=="string"||!UID.test(user.id)||user.is_anonymous===true)return null;
  return {id:user.id,token};
 }
 async function handle(req,action){
  if(action==="reports"){
   if(!reportsReady)return outcome(503,{error:"report-inbox-not-open",...assessDelivery()});
  }else if(!ready)return outcome(503,{error:"customer-intake-not-open",...assessDelivery()});
  const owner=await resolveUser(req).catch(()=>null);
  if(!owner)return outcome(401,{error:"authenticated-customer-required"});
  if(action==="reports"){
   try{
    // PostgREST is granted SELECT on these five metadata columns ONLY.
    // RLS independently enforces auth.uid() = owner_user_id, including on direct API access.
    const url="/rest/v1/gatehouse_customer_reports?select=id%2Csite_id%2Cowner_user_id%2Cdelivery_state%2Ccreated_at&owner_user_id=eq."+
     encodeURIComponent(owner.id)+"&order=created_at.desc&limit=25";
    const result=await remote(url,"GET",owner.token);
    if(!result.ok||!Array.isArray(result.data)||result.data.length>25||
      result.data.some(v=>!v||!UID.test(v.id||"")||!UID.test(v.site_id||"")||
       v.owner_user_id!==owner.id||v.delivery_state!=="withheld"||
       typeof v.created_at!=="string"||v.created_at.length>60||
       !Number.isFinite(Date.parse(v.created_at))))
      return outcome(503,{error:"private-report-storage-unavailable"});
    return outcome(200,{
      reports:result.data.map(v=>({id:v.id,siteId:v.site_id,
       deliveryState:"withheld",createdAt:v.created_at})),
      count:result.data.length,reportContentVisible:false,
      deliveryAuthorized:false,verifiedPaidOrder:false
    });
   }catch{return outcome(503,{error:"private-report-storage-unavailable"})}
  }
  if(action==="create"){
   let row;
   try{row=buildTenantSiteRow({userId:owner.id,submitted:req.body})}
   catch{return outcome(422,{error:"site-consent-or-origin-invalid"})}
   try{
    const added=await remote("/rest/v1/gatehouse_customer_sites?select=id%2Cstage","POST",owner.token,row);
    if(!added.ok)return outcome(added.status===409?409:503,{error:added.status===409?"site-already-registered":"private-site-storage-unavailable"});
    if(!Array.isArray(added.data)||added.data.length!==1||!UID.test(added.data[0]?.id))
     return outcome(503,{error:"unverified-storage-response"});
    return outcome(201,{siteId:added.data[0].id,...publicAccountState(added.data[0])});
   }catch{return outcome(503,{error:"private-site-storage-unavailable"})}
  }
  if(action==="list"){
   try{
    const url="/rest/v1/gatehouse_customer_sites?select=id%2Corigin%2Cstage%2Cauthorized_at&owner_user_id=eq."+encodeURIComponent(owner.id)+"&limit=25";
    const found=await remote(url,"GET",owner.token);
    if(!found.ok||!Array.isArray(found.data))return outcome(503,{error:"private-site-storage-unavailable"});
    return outcome(200,{sites:found.data.map(v=>({
      id:UID.test(v?.id||"")?v.id:null,
      origin:typeof v?.origin==="string"&&v.origin.length<=256?v.origin:null,
      stage:v?.stage==="awaiting-domain-control"?"awaiting-domain-control":"unknown",
      authorizedAt:typeof v?.authorized_at==="string"?v.authorized_at:null
     })),purchaseEnabled:false,deliveryAuthorized:false});
   }catch{return outcome(503,{error:"private-site-storage-unavailable"})}
  }
  return outcome(404,{error:"route-not-available"});
 }
 return {handle};
}
