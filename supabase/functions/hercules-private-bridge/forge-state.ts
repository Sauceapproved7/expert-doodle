const ACTIONS=new Set([
  "forge_state_status",
  "forge_state_manifest",
  "forge_state_put_chunk",
  "forge_state_commit_object",
  "forge_state_get_chunk",
  "forge_state_delete_object",
]);
const ROOTS=["projects","identity","audit","runtime-data","runtime-snapshots","releases"];
const SHA=/^[a-f0-9]{64}$/;
const MAX_CHUNK_BYTES=1024*1024;
const MAX_OBJECT_BYTES=64*1024*1024;
const MAX_CHUNKS=4096;
const HEADERS={
  "content-type":"application/json; charset=utf-8",
  "cache-control":"no-store",
  "x-content-type-options":"nosniff",
  "referrer-policy":"no-referrer",
};

const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:HEADERS});

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
  if(!ROOTS.some(root=>path.startsWith(root+"/")))return null;
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
async function authorized(req:Request,admin:any){
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
async function body(req:Request){
  const text=await req.text();
  if(text.length>1800000)throw new Error("request_too_large");
  try{return text?JSON.parse(text):{}}catch{throw new Error("invalid_json")}
}

export function isForgeStateAction(action:string){
  return ACTIONS.has(String(action||""));
}

export async function handleForgeStateRequest(req:Request,admin:any){
  if(req.method!=="POST")return out({error:"method_not_allowed"},405);
  if(!(await authorized(req,admin)))return out({error:"forge_state_unauthorized"},401);

  try{
    const request:any=await body(req);
    const action=String(request.action||"");
    if(!ACTIONS.has(action))return out({error:"unknown_forge_state_action"},400);

    if(action==="forge_state_status"){
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

    if(action==="forge_state_manifest"){
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

    const path=validPath(request.path);
    if(!path)return out({error:"invalid_path"},400);

    if(action==="forge_state_put_chunk"){
      const index=integer(request.index,0,MAX_CHUNKS-1);
      const bytes=integer(request.bytes,0,MAX_CHUNK_BYTES);
      const digest=validSha(request.sha256);
      const objectSha256=validSha(request.objectSha256);
      if(index===null||bytes===null||!digest||!objectSha256)return out({error:"invalid_chunk_metadata"},400);
      const content=decodeBase64(request.contentBase64);
      if(content.byteLength!==bytes)return out({error:"chunk_size_mismatch"},409);
      if((await sha256HexBytes(content))!==digest)return out({error:"chunk_integrity_mismatch"},409);
      const {error}=await admin.from("hercules_forge_state_chunks").upsert({
        path,
        object_sha256:objectSha256,
        chunk_index:index,
        sha256:digest,
        bytes,
        content_base64:String(request.contentBase64),
        updated_at:new Date().toISOString(),
      },{onConflict:"path,object_sha256,chunk_index"});
      if(error)throw new Error("chunk_write_failed");
      return out({ok:true,path,index,bytes});
    }

    if(action==="forge_state_commit_object"){
      const bytes=integer(request.bytes,0,MAX_OBJECT_BYTES);
      const chunks=integer(request.chunks,1,MAX_CHUNKS);
      const digest=validSha(request.sha256);
      if(bytes===null||chunks===null||!digest)return out({error:"invalid_object_metadata"},400);

      const {data,error}=await admin.from("hercules_forge_state_chunks")
        .select("chunk_index,sha256,bytes,content_base64")
        .eq("path",path)
        .eq("object_sha256",digest)
        .lt("chunk_index",chunks)
        .order("chunk_index");
      if(error)throw new Error("chunk_manifest_read_failed");
      if(!data||data.length!==chunks)return out({error:"missing_chunk"},409);

      let total=0;
      const objectBytes=new Uint8Array(bytes);
      let offset=0;
      for(let i=0;i<chunks;i++){
        const row:any=data[i];
        if(Number(row.chunk_index)!==i||!validSha(row.sha256))return out({error:"chunk_manifest_invalid"},409);
        const content=decodeBase64(row.content_base64);
        const rowBytes=Number(row.bytes);
        if(content.byteLength!==rowBytes||await sha256HexBytes(content)!==String(row.sha256)){
          return out({error:"chunk_integrity_mismatch"},409);
        }
        if(offset+content.byteLength>bytes)return out({error:"object_size_mismatch"},409);
        objectBytes.set(content,offset);
        offset+=content.byteLength;
        total+=content.byteLength;
      }
      if(total!==bytes)return out({error:"object_size_mismatch"},409);
      if(await sha256HexBytes(objectBytes)!==digest)return out({error:"object_integrity_mismatch"},409);

      const now=new Date().toISOString();
      const {error:upsertError}=await admin.from("hercules_forge_state_objects").upsert({
        path,sha256:digest,bytes,chunk_count:chunks,updated_at:now,
      },{onConflict:"path"});
      if(upsertError)throw new Error("object_commit_failed");
      const [{error:staleGenerationError},{error:staleIndexError}]=await Promise.all([
        admin.from("hercules_forge_state_chunks").delete().eq("path",path).neq("object_sha256",digest),
        admin.from("hercules_forge_state_chunks").delete().eq("path",path).eq("object_sha256",digest).gte("chunk_index",chunks),
      ]);
      if(staleGenerationError||staleIndexError)throw new Error("stale_chunk_cleanup_failed");
      return out({ok:true,path,bytes,chunks,sha256:digest});
    }

    if(action==="forge_state_get_chunk"){
      const index=integer(request.index,0,MAX_CHUNKS-1);
      const objectSha256=validSha(request.objectSha256);
      if(index===null||!objectSha256)return out({error:"invalid_chunk_index"},400);
      const {data:manifest,error:manifestError}=await admin.from("hercules_forge_state_objects")
        .select("sha256")
        .eq("path",path)
        .eq("sha256",objectSha256)
        .maybeSingle();
      if(manifestError)throw new Error("object_manifest_read_failed");
      if(!manifest)return out({error:"not_found"},404);
      const {data,error}=await admin.from("hercules_forge_state_chunks")
        .select("path,object_sha256,chunk_index,sha256,bytes,content_base64")
        .eq("path",path)
        .eq("object_sha256",objectSha256)
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

    if(action==="forge_state_delete_object"){
      const [{error:chunkError},{error:objectError}]=await Promise.all([
        admin.from("hercules_forge_state_chunks").delete().eq("path",path),
        admin.from("hercules_forge_state_objects").delete().eq("path",path),
      ]);
      if(chunkError||objectError)throw new Error("object_delete_failed");
      return out({ok:true,path,deleted:true});
    }

    return out({error:"unknown_forge_state_action"},400);
  }catch(error){
    const message=error instanceof Error?error.message:"internal_error";
    const clientErrors=new Set(["request_too_large","invalid_json","invalid_base64","chunk_too_large"]);
    return out({error:clientErrors.has(message)?message:"internal_error"},clientErrors.has(message)?400:500);
  }
}
