import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2';

const U=Deno.env.get('SUPABASE_URL')!;
const A=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY')||'';
const S=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const admin=createClient(U,S,{auth:{persistSession:false}});
const H={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:H});
const validReference=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

async function actor(req:Request){
  const h=req.headers.get('authorization')||'';
  const token=h.startsWith('Bearer ')?h.slice(7):'';
  if(!token)return null;
  const db=createClient(U,A,{auth:{persistSession:false},global:{headers:{Authorization:'Bearer '+token}}});
  const {data,error}=await db.auth.getUser(token);
  if(error||!data.user)return null;
  const {data:m}=await db.from('hercules_memberships')
    .select('organization_id,role,status')
    .eq('user_id',data.user.id)
    .eq('status','active')
    .in('role',['owner','admin'])
    .limit(1)
    .maybeSingle();
  return m?{user:data.user,m}:null;
}

async function audit(org:string,uid:string,action:string,reference:string,changes:Record<string,unknown>){
  await admin.from('hercules_audit_log').insert({
    organization_id:org,
    actor_user_id:uid,
    action,
    resource_type:'hercules_privacy_request',
    resource_id:reference,
    changes,
    metadata:{source:'hercules-privacy-ops-v1',secret_exposure:false}
  });
}

Deno.serve(async(req:Request)=>{
  if(req.method==='GET')return out({
    ok:true,
    service:'hercules-privacy-ops',
    version:'1.0.0',
    status:'ready',
    capabilities:['privacy_export','privacy_deletion_plan','privacy_delete_user_content']
  });
  if(req.method!=='POST')return out({error:'method_not_allowed'},405);

  const a=await actor(req);
  if(!a)return out({error:'owner_or_admin_required'},403);

  const b=await req.json().catch(()=>({}));
  const action=String(b.action||'').trim();
  const reference=String(b.reference||'').trim().toLowerCase();
  if(!validReference(reference))return out({error:'valid_reference_required'},400);

  if(action==='privacy_export'){
    const {data,error}=await admin.rpc('hercules_privacy_request_export',{p_public_reference:reference});
    if(error)return out({error:'privacy_export_failed',detail:error.message},500);
    if(data?.ok===false)return out(data,409);
    await admin.from('hercules_privacy_requests')
      .update({
        status:'in_progress',
        updated_at:new Date().toISOString()
      })
      .eq('public_reference',reference);
    await audit(String(a.m.organization_id),String(a.user.id),'privacy.request.export.generated',reference,{
      schemaVersion:data?.schema_version||null,
      sizeBytes:data?.size_bytes||null
    });
    return out(data);
  }

  if(action==='privacy_deletion_plan'){
    const {data,error}=await admin.rpc('hercules_privacy_request_deletion_plan',{p_public_reference:reference});
    if(error)return out({error:'privacy_deletion_plan_failed',detail:error.message},500);
    return out(data,data?.ok===false?409:200);
  }

  if(action==='privacy_delete_user_content'){
    if(String(a.m.role)!=='owner')return out({error:'owner_required'},403);
    const confirmation=String(b.confirmation||'').trim().toUpperCase();
    const expected='DELETE '+reference.toUpperCase();
    if(confirmation!==expected)return out({error:'explicit_confirmation_required',expected},400);

    const {data,error}=await admin.rpc('hercules_privacy_request_delete_user_content',{
      p_public_reference:reference,
      p_confirmation:confirmation
    });
    if(error)return out({error:'privacy_delete_user_content_failed',detail:error.message},500);
    if(data?.ok===false)return out(data,409);

    await audit(String(a.m.organization_id),String(a.user.id),'privacy.request.user_content_deleted',reference,{
      deleted:data?.deleted||{},
      fullAccountDeletionComplete:false,
      preservedForReview:data?.preserved_for_review||[]
    });
    return out(data);
  }

  return out({error:'unknown_action'},400);
});
