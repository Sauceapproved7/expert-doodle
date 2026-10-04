import {randomUUID} from "node:crypto";
import {verifyJwtHs256} from "./auth-core.mjs";
import {
  functionFingerprint,
  normalizeFunctionManifest,
} from "./functions-core.mjs";

const MAX_BODY_BYTES=32*1024;

function json(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      "content-type":"application/json; charset=utf-8",
      "cache-control":"no-store",
      "x-content-type-options":"nosniff",
    },
  });
}

function authenticate(request,jwtSecret){
  const header=request.headers.get("authorization")||"";
  if(!header.startsWith("Bearer "))throw new Error("unauthorized");
  const claims=verifyJwtHs256(header.slice(7),jwtSecret,{
    issuer:"hercules-base",
    audience:"hercules-base-api",
  });
  if(claims.role!=="staging_user")throw new Error("unauthorized");
  return claims;
}

async function readJsonBounded(request){
  const declared=Number(request.headers.get("content-length"));
  if(Number.isFinite(declared)&&declared>MAX_BODY_BYTES){
    const error=new Error("request body too large");
    error.status=413;
    throw error;
  }
  const text=await request.text();
  if(new TextEncoder().encode(text).byteLength>MAX_BODY_BYTES){
    const error=new Error("request body too large");
    error.status=413;
    throw error;
  }
  try{return JSON.parse(text||"{}");}
  catch{throw new TypeError("invalid JSON");}
}

function pathName(pathname){
  const prefix="/v1/functions/";
  if(!pathname.startsWith(prefix))return null;
  const rest=pathname.slice(prefix.length);
  const slash=rest.indexOf("/");
  const raw=slash<0?rest:rest.slice(0,slash);
  let name;
  try{name=decodeURIComponent(raw);}catch{throw new TypeError("function name is invalid");}
  if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name)){
    throw new TypeError("function name is invalid");
  }
  return {name,tail:slash<0?"":rest.slice(slash+1)};
}

export async function routeFunctionsRequest(request,{
  jwtSecret,
  store,
  executor=null,
}={}){
  if(!store)return json({ok:false,error:"functions_store_unavailable"},503);

  let claims;
  try{claims=authenticate(request,jwtSecret);}
  catch{return json({ok:false,error:"unauthorized"},401);}

  const url=new URL(request.url);

  if(request.method==="POST"&&url.pathname==="/v1/functions"){
    try{
      const body=await readJsonBounded(request);
      const manifest=normalizeFunctionManifest(body);
      const fingerprint=functionFingerprint(manifest);
      const record=await store.register({
        id:randomUUID(),
        ownerId:claims.sub,
        manifest,
        fingerprint,
      });
      return json({ok:true,function:record},201);
    }catch(error){
      const status=error?.status===413?413:400;
      return json({
        ok:false,
        error:status===413?"request_body_too_large":"invalid_function_manifest",
      },status);
    }
  }

  if(request.method==="GET"&&url.pathname==="/v1/functions"){
    try{
      const functions=await store.list({ownerId:claims.sub});
      return json({ok:true,functions});
    }catch{
      return json({ok:false,error:"functions_list_failed"},400);
    }
  }

  let parsed;
  try{parsed=pathName(url.pathname);}
  catch{return json({ok:false,error:"invalid_function_path"},400);}

  if(parsed&&request.method==="GET"&&!parsed.tail){
    try{
      const record=await store.get({ownerId:claims.sub,name:parsed.name});
      return record?json({ok:true,function:record}):json({ok:false,error:"function_not_found"},404);
    }catch{
      return json({ok:false,error:"function_lookup_failed"},400);
    }
  }

  if(parsed?.tail==="invoke"&&request.method==="POST"){
    if(!executor||typeof executor.invoke!=="function"){
      return json({
        ok:false,
        error:"isolated_function_executor_unavailable",
        control_plane_ready:true,
      },503);
    }

    return json({
      ok:false,
      error:"isolated_function_executor_not_enabled",
    },503);
  }

  return json({ok:false,error:"functions_route_not_found"},404);
}
