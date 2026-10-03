import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.57.4';

const U=Deno.env.get('SUPABASE_URL')!;
const P=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY')||'';
const S=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const admin=createClient(U,S,{auth:{persistSession:false,autoRefreshToken:false}});
const enc=new TextEncoder();
const MAX_BODY_BYTES=8*1024;
const CHOICES=new Set(['soundworld-pods','soundworld-max','soundworld-portable-speaker']);
const ORIGINS=new Set([
  'https://sauceapproved-studio.onrender.com',
  'https://sauceapproved.com',
  'https://www.sauceapproved.com'
]);

function cors(req:Request){
  const origin=req.headers.get('origin')||'';
  const allow=ORIGINS.has(origin)?origin:'https://sauceapproved-studio.onrender.com';
  return {
    'access-control-allow-origin':allow,
    'access-control-allow-headers':'authorization, content-type, apikey, x-client-info',
    'access-control-allow-methods':'GET, POST, OPTIONS',
    'vary':'Origin'
  };
}

function out(req:Request,body:unknown,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      ...cors(req),
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
      'x-content-type-options':'nosniff',
      'referrer-policy':'no-referrer'
    }
  });
}

async function sha256Hex(value:string){
  const digest=await crypto.subtle.digest('SHA-256',enc.encode(value));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}

function normalizeEmail(value:string){
  return String(value||'').trim().toLowerCase();
}

async function authIdentity(req:Request){
  const auth=req.headers.get('authorization')||'';
  if(!auth.toLowerCase().startsWith('bearer '))return null;
  const token=auth.slice(7).trim();
  if(!token)return null;

  const client=createClient(U,P,{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:'Bearer '+token}}
  });
  const {data,error}=await client.auth.getUser(token);
  if(error||!data.user)return null;
  const email=normalizeEmail(data.user.email||'');
  return {
    user:data.user,
    buyer_email_sha256:email?await sha256Hex(email):null
  };
}

async function readJson(req:Request){
  const len=Number(req.headers.get('content-length')||'0');
  if(Number.isFinite(len)&&len>MAX_BODY_BYTES)throw new Error('payload_too_large');
  const raw=await req.text();
  if(raw.length>MAX_BODY_BYTES)throw new Error('payload_too_large');
  try{return raw?JSON.parse(raw):{}}
  catch{throw new Error('invalid_json')}
}

function publicEligibility(row:any){
  return {
    purchaseKey:String(row.purchase_key),
    provider:String(row.provider),
    productCode:String(row.product_code),
    purchasedAt:row.purchased_at,
    amountCents:Number(row.amount_cents||0),
    currency:String(row.currency||'USD'),
    promotionOpenedAt:row.promotion_opened_at,
    promotionClosesAt:row.promotion_closes_at,
    status:String(row.status||'eligible'),
    claimedAt:row.claimed_at||null
  };
}

async function eligibleForUser(userId:string,emailHash:string|null){
  const select='purchase_key,provider,product_code,organization_id,user_id,buyer_email_sha256,purchased_at,amount_cents,currency,promotion_opened_at,promotion_closes_at,status,claimed_at';

  const tasks:any[]=[
    admin.from('hercules_soundworld_gift_eligibility').select(select).eq('user_id',userId)
  ];
  if(emailHash){
    tasks.push(
      admin.from('hercules_soundworld_gift_eligibility').select(select).eq('buyer_email_sha256',emailHash)
    );
  }

  const results=await Promise.all(tasks);
  const merged=new Map<string,any>();
  for(const result of results){
    if(result.error)throw result.error;
    for(const row of result.data||[])merged.set(String(row.purchase_key),row);
  }

  return [...merged.values()]
    .sort((a:any,b:any)=>new Date(b.purchased_at).getTime()-new Date(a.purchased_at).getTime())
    .map(publicEligibility);
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});

  const identity=await authIdentity(req);
  if(!identity)return out(req,{ok:false,error:'authentication_required'},401);

  if(req.method==='GET'){
    try{
      const [eligibility,{data:reservations,error:reservationError}]=await Promise.all([
        eligibleForUser(String(identity.user.id),identity.buyer_email_sha256),
        admin.from('hercules_soundworld_gift_reservations')
          .select('purchase_key,gift_code,customer_price_cents,status,fulfillment_mode,reserved_at,fulfilled_at,canceled_at')
          .eq('user_id',String(identity.user.id))
          .order('reserved_at',{ascending:false})
      ]);
      if(reservationError)throw reservationError;
      return out(req,{
        ok:true,
        promotion:'hercules-soundworld-launch-gift-v1',
        choices:['soundworld-pods','soundworld-max','soundworld-portable-speaker'],
        eligibility,
        reservations:reservations||[]
      });
    }catch(error){
      return out(req,{ok:false,error:'gift_status_unavailable',detail:error instanceof Error?error.message:'unknown'},500);
    }
  }

  if(req.method!=='POST')return out(req,{ok:false,error:'method_not_allowed'},405);

  try{
    const body=await readJson(req);
    const purchaseKey=String(body.purchaseKey||body.purchase_key||'').trim();
    const giftCode=String(body.giftCode||body.gift_code||'').trim().toLowerCase();
    if(!purchaseKey)return out(req,{ok:false,error:'purchase_key_required'},400);
    if(!CHOICES.has(giftCode))return out(req,{ok:false,error:'invalid_soundworld_gift_choice'},400);

    const {data,error}=await admin.rpc('hercules_soundworld_claim_gift',{
      p_purchase_key:purchaseKey,
      p_gift_code:giftCode,
      p_user_id:String(identity.user.id),
      p_buyer_email_sha256:identity.buyer_email_sha256
    });
    if(error){
      const message=String(error.message||'');
      if(message.includes('gift_already_reserved_for_purchase')){
        return out(req,{ok:false,error:'gift_already_reserved_for_purchase'},409);
      }
      if(message.includes('purchase_identity_mismatch')){
        return out(req,{ok:false,error:'purchase_identity_mismatch'},403);
      }
      if(message.includes('purchase_not_eligible')){
        return out(req,{ok:false,error:'purchase_not_eligible'},404);
      }
      return out(req,{ok:false,error:'gift_claim_failed'},422);
    }

    return out(req,{ok:true,reservation:data},201);
  }catch(error){
    const message=error instanceof Error?error.message:'unknown';
    if(message==='payload_too_large')return out(req,{ok:false,error:message},413);
    if(message==='invalid_json')return out(req,{ok:false,error:message},400);
    return out(req,{ok:false,error:'gift_claim_failed'},500);
  }
});
