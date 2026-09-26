import {timingSafeEqual} from "node:crypto";
import {
  BASE_CAPABILITIES,
  compileBackendIntent,
  normalizeBackendIntent,
} from "./core.mjs";

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

function bearerMatches(header,expected){
  if(typeof expected!=="string"||expected.length<1)return false;
  if(typeof header!=="string"||!header.startsWith("Bearer "))return false;
  const actual=header.slice(7);
  const left=Buffer.from(actual);
  const right=Buffer.from(expected);
  return left.length===right.length&&timingSafeEqual(left,right);
}

async function readJsonBounded(request){
  const declared=Number(request.headers.get("content-length"));
  if(Number.isFinite(declared)&&declared>MAX_BODY_BYTES){
    return {error:json({ok:false,error:"request_body_too_large"},413)};
  }

  const text=await request.text();
  if(new TextEncoder().encode(text).byteLength>MAX_BODY_BYTES){
    return {error:json({ok:false,error:"request_body_too_large"},413)};
  }

  try{
    const value=JSON.parse(text||"{}");
    return {value};
  }catch{
    return {error:json({ok:false,error:"invalid_json"},400)};
  }
}

export async function routeBaseRequest(request,{controlToken}={}){
  let url;
  try{
    url=new URL(request.url);
  }catch{
    return json({ok:false,error:"invalid_url"},400);
  }

  if(request.method==="GET"&&url.pathname==="/health"){
    return json({
      ok:true,
      platform:"hercules-base",
      version:"1",
      supabaseDependency:false,
    });
  }

  if(request.method==="GET"&&url.pathname==="/v1/capabilities"){
    return json({
      ok:true,
      platform:"hercules-base",
      capabilities:BASE_CAPABILITIES,
    });
  }

  if(request.method==="POST"&&url.pathname==="/v1/blueprints/compile"){
    if(!bearerMatches(request.headers.get("authorization"),controlToken)){
      return json({ok:false,error:"unauthorized"},401);
    }

    const body=await readJsonBounded(request);
    if(body.error)return body.error;

    try{
      const intent=normalizeBackendIntent(body.value);
      const blueprint=compileBackendIntent(intent);
      return json({ok:true,blueprint});
    }catch(error){
      return json({
        ok:false,
        error:"invalid_backend_intent",
        message:error instanceof Error?error.message:"invalid backend intent",
      },400);
    }
  }

  return json({ok:false,error:"route_not_found"},404);
}
