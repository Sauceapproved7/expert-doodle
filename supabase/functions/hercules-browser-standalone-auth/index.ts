// token verifier; deploy with verify_jwt=false
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";

const U=Deno.env.get("SUPABASE_URL")!;
const S=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const admin=createClient(U,S,{auth:{persistSession:false}});
const headers={
  "content-type":"application/json; charset=utf-8",
  "cache-control":"no-store",
  "x-content-type-options":"nosniff",
  "referrer-policy":"no-referrer"
};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});

Deno.serve(async req=>{
  if(req.method!=="POST")return out({ok:false,error:"method_not_allowed"},405);
  const length=Number(req.headers.get("content-length")||"0");
  if(length>4096)return out({ok:false,error:"request_too_large"},413);

  let body:any={};
  try{body=await req.json()}catch{return out({ok:false,error:"invalid_json"},400)}
  const token=String(body?.token||"");
  if(!/^[0-9a-fA-F]{64}$/.test(token))return out({ok:false,error:"invalid_token_format"},400);

  const {data,error}=await admin.rpc("hercules_browser_standalone_token_consume",{p_token:token});
  if(error)return out({ok:false,error:"token_verification_failed"},500);
  if(!data?.ok)return out({ok:false,error:data?.error||"unauthorized"},401);

  return out({ok:true,purpose:data.purpose,expires_at:data.expires_at});
});
