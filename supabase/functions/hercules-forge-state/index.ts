import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.117.2";

const U=Deno.env.get("SUPABASE_URL")!;
const S=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const admin=createClient(U,S,{auth:{persistSession:false}});
const H={
  "content-type":"application/json; charset=utf-8",
  "cache-control":"no-store",
  "x-content-type-options":"nosniff",
  "referrer-policy":"no-referrer",
};
const PATH_ROOTS=["projects","identity","audit","runtime-data","runtime-snapshots","releases"] as const;
const SHA=/^[a-f0-9]{64}$/;
const MAX_CHUNK_BYTES=1024*1024;
const MAX_OBJECT_BYTES=64*1024*1024;
const MAX_CHUNKS=4096;

const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:H});

function safeEqual(a:string,b:string){
  if(a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
async function sha256HexBytes(bytes:Uint8Array){
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function sha256HexText(value:string){
  return sha256HexBytes(new TextEncoder().encode(value));
}
function validPath(value:unknown){
  const path=String(value??"");
  if(!path||path.length>1024||path.startsWith("/")||path.includes("\\")||path.includes("\0"))return null;
  const parts=path.split("/");
  if(parts.some(part=>!part||part==="."||part===".."))return null;
  if(!PATH_ROOTS.some(root=>path.startsWith(root+"/")))return null;
  return path;
}
function integer(value:unknown,min:number,max:number){
  const n=Number(value);
  return Number.isSafeInteger(n)&&n>=min&&n<=max?n:null;
}
function validSha(value:unknown){
  const digest=String(value??"");
  return SHA.test(digest)?digest:null;
}
function decodeBase64(value:unknown){
  const text=String(value??"");
  if(text.length>1500000)throw new Error("chunk_too_large");
  try{
    const raw=atob(text);
    const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    return bytes;
  }catch{
    throw new Error("invalid_base64");
  }
}
async function authorized(req:Request){
  const supplied=req.headers.get("x-hercules-forge-state-key")||"";
  if(supplied.length<32)return false;
  const digest=await sha256HexText(supplied);
  const {data,error}=await admin.from("hercules_internal_service_keys")
    .select("key_sha256,enabled")
    .eq("purpose","forge-durable-state")
    .eq("enabled",true)
    .limit(1)
    .maybeSingle();
  if(error||!data?.key_sha256)return false;
  return safeEqual(String(data.key_sha256),digest);
}
async function json(req:Request){
  const text=await req.text();
  if(text.length>1800000)throw new Error("request_too_large");
  try{return text?JSON.parse(text):{}}catch{throw new Error("invalid_json")}
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return out({error:"method_not_allowed"},405);
  if(!(await authorized(req)))return out({error:"unauthorized"},401);

  try{
    const body:any=await json(req);
    const action=String(body.action||"");

    if(action==="status"){
      const {count,error}=await admin.from("hercules_forge_state_objects")
        .select("path",{count:"exact",head:true});
      if(error)throw new Error("state_status_failed");
      return out({
        ok:true,
        schema:"sauceapproved.hercules.forge.durable-state.v1",
        objectCount:count||0,
        chunkBytesRecommended:192*1024,
        maxObjectBytes:MAX_OBJECT_BYTES,
        carriesCredentials:false,
      });
    }

    if(action==="manifest"){
      const {data,error}=await admin.from("hercules_forge_state_objects")
        .select("path,sha256,bytes,chunk_count,updated_at")
        .order("path");
      if(error)throw new Error("manifest_read_failed");
      return out({
        ok:true,
        objects:(data||[]).map((row:any)=>({
          path:row.path,
          sha256:row.sha256,
          bytes:Number(row.bytes),
          chunks:Number(row.chunk_count),
          updatedAt:row.updated_at,
        })),
      });
    }

    const path=validPath(body.path);
    if(!path)return out({error:"invalid_path"},400);

    if(action==="put_chunk"){
      const index=integer(body.index,0,MAX_CHUNKS-1);
      const bytes=integer(body.bytes,0,MAX_CHUNK_BYTES);
      const digest=validSha(body.sha256);
      if(index===null||bytes===null||!digest)return out({error:"invalid_chunk_metadata"},400);
      const content=decodeBase64(body.contentBase64);
      if(content.byteLength!==bytes)return out({error:"chunk_size_mismatch"},409);
      if((await sha256HexBytes(content))!==digest)return out({error:"chunk_integrity_mismatch"},409);
      const {error}=await admin.from("hercules_forge_state_chunks").upsert({
        path,
        chunk_index:index,
        sha256:digest,
        bytes,
        content_base64:String(body.contentBase64),
        updated_at:new Date().toISOString(),
      },{onConflict:"path,chunk_index"});
      if(error)throw new Error("chunk_write_failed");
      return out({ok:true,path,index,bytes});
    }

    if(action==="commit_object"){
      const bytes=integer(body.bytes,0,MAX_OBJECT_BYTES);
      const chunks=integer(body.chunks,1,MAX_CHUNKS);
      const digest=validSha(body.sha256);
      if(bytes===null||chunks===null||!digest)return out({error:"invalid_object_metadata"},400);

      const {data,error}=await admin.from("hercules_forge_state_chunks")
        .select("chunk_index,sha256,bytes")
        .eq("path",path)
        .lt("chunk_index",chunks)
        .order("chunk_index");
      if(error)throw new Error("chunk_manifest_read_failed");
      if(!data||data.length!==chunks)return out({error:"missing_chunk"},409);

      let total=0;
      for(let i=0;i<chunks;i++){
        const row:any=data[i];
        if(Number(row.chunk_index)!==i||!validSha(row.sha256))return out({error:"chunk_manifest_invalid"},409);
        total+=Number(row.bytes);
      }
      if(total!==bytes)return out({error:"object_size_mismatch"},409);

      const now=new Date().toISOString();
      const {error:upsertError}=await admin.from("hercules_forge_state_objects").upsert({
        path,sha256:digest,bytes,chunk_count:chunks,updated_at:now,
      },{onConflict:"path"});
      if(upsertError)throw new Error("object_commit_failed");

      const {error:cleanupError}=await admin.from("hercules_forge_state_chunks")
        .delete().eq("path",path).gte("chunk_index",chunks);
      if(cleanupError)throw new Error("stale_chunk_cleanup_failed");
      return out({ok:true,path,bytes,chunks,sha256:digest});
    }

    if(action==="get_chunk"){
      const index=integer(body.index,0,MAX_CHUNKS-1);
      if(index===null)return out({error:"invalid_chunk_index"},400);
      const {data,error}=await admin.from("hercules_forge_state_chunks")
        .select("path,chunk_index,sha256,bytes,content_base64")
        .eq("path",path)
        .eq("chunk_index",index)
        .maybeSingle();
      if(error)throw new Error("chunk_read_failed");
      if(!data)return out({error:"not_found"},404);
      return out({
        ok:true,
        chunk:{
          path:data.path,
          index:Number(data.chunk_index),
          sha256:data.sha256,
          bytes:Number(data.bytes),
          contentBase64:data.content_base64,
        },
      });
    }

    if(action==="delete_object"){
      const [{error:chunkError},{error:objectError}]=await Promise.all([
        admin.from("hercules_forge_state_chunks").delete().eq("path",path),
        admin.from("hercules_forge_state_objects").delete().eq("path",path),
      ]);
      if(chunkError||objectError)throw new Error("object_delete_failed");
      return out({ok:true,path,deleted:true});
    }

    return out({error:"unknown_action"},400);
  }catch(error){
    const message=error instanceof Error?error.message:"internal_error";
    const clientErrors=new Set(["request_too_large","invalid_json","invalid_base64","chunk_too_large"]);
    return out({error:clientErrors.has(message)?message:"internal_error"},clientErrors.has(message)?400:500);
  }
});
