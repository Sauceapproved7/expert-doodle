import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {verifyJwtHs256} from "./auth-core.mjs";
import {normalizeBucketName,normalizeObjectKey} from "./storage-core.mjs";

const MAX_JSON_BYTES=4096;

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

async function readJson(request){
  const declared=Number(request.headers.get("content-length"));
  if(Number.isFinite(declared)&&declared>MAX_JSON_BYTES)throw new TypeError("request body too large");
  const text=await request.text();
  if(new TextEncoder().encode(text).byteLength>MAX_JSON_BYTES)throw new TypeError("request body too large");
  try{return JSON.parse(text||"{}");}catch{throw new TypeError("invalid JSON");}
}

async function readObjectBytes(request,maxObjectBytes){
  const declared=Number(request.headers.get("content-length"));
  if(Number.isFinite(declared)&&declared>maxObjectBytes){
    const error=new Error("object too large");
    error.status=413;
    throw error;
  }
  const bytes=Buffer.from(await request.arrayBuffer());
  if(bytes.byteLength>maxObjectBytes){
    const error=new Error("object too large");
    error.status=413;
    throw error;
  }
  return bytes;
}

function parseObjectPath(pathname){
  const prefix="/v1/storage/objects/";
  if(!pathname.startsWith(prefix))return null;
  const rest=pathname.slice(prefix.length);
  const slash=rest.indexOf("/");
  if(slash<1)return null;
  let bucketRaw=rest.slice(0,slash);
  let keyRaw=rest.slice(slash+1);
  try{bucketRaw=decodeURIComponent(bucketRaw);}catch{throw new TypeError("bucket name is invalid");}
  return {
    bucket:normalizeBucketName(bucketRaw),
    objectKey:normalizeObjectKey(keyRaw),
  };
}

export async function routeStorageRequest(request,{
  jwtSecret,
  store,
  blobs,
  maxObjectBytes=10*1024*1024,
}={}){
  if(!store||!blobs)return json({ok:false,error:"storage_unavailable"},503);

  let claims;
  try{claims=authenticate(request,jwtSecret);}
  catch{return json({ok:false,error:"unauthorized"},401);}

  const url=new URL(request.url);

  if(request.method==="POST"&&url.pathname==="/v1/storage/buckets"){
    try{
      const body=await readJson(request);
      const name=normalizeBucketName(body.name);
      const bucket=await store.createBucket({
        id:randomUUID(),
        ownerId:claims.sub,
        name,
      });
      return json({ok:true,bucket},201);
    }catch(error){
      return json({ok:false,error:"invalid_bucket"},error?.status||400);
    }
  }

  const parsed=parseObjectPath(url.pathname);
  if(parsed){
    if(request.method==="PUT"){
      try{
        const bytes=await readObjectBytes(request,maxObjectBytes);
        const blob=await blobs.put(bytes);
        const object=await store.putObject({
          id:randomUUID(),
          ownerId:claims.sub,
          bucket:parsed.bucket,
          objectKey:parsed.objectKey,
          sha256:blob.sha256,
          sizeBytes:blob.sizeBytes,
          contentType:(request.headers.get("content-type")||"application/octet-stream").slice(0,255),
        });
        return json({ok:true,object},201);
      }catch(error){
        const status=error?.status===413?413:400;
        return json({ok:false,error:status===413?"object_too_large":"storage_write_failed"},status);
      }
    }

    if(request.method==="GET"){
      try{
        const object=await store.getObject({
          ownerId:claims.sub,
          bucket:parsed.bucket,
          objectKey:parsed.objectKey,
        });
        if(!object)return json({ok:false,error:"object_not_found"},404);
        const bytes=await readFile(blobs.pathForDigest(object.sha256));
        return new Response(bytes,{
          status:200,
          headers:{
            "content-type":object.content_type||"application/octet-stream",
            "content-length":String(bytes.byteLength),
            "etag":'"sha256-'+object.sha256+'"',
            "cache-control":"private, no-store",
            "x-content-type-options":"nosniff",
          },
        });
      }catch{
        return json({ok:false,error:"object_not_found"},404);
      }
    }

    if(request.method==="DELETE"){
      try{
        const object=await store.deleteObject({
          ownerId:claims.sub,
          bucket:parsed.bucket,
          objectKey:parsed.objectKey,
        });
        return object?json({ok:true,deleted:true}):json({ok:false,error:"object_not_found"},404);
      }catch{
        return json({ok:false,error:"object_delete_failed"},400);
      }
    }
  }

  const listPrefix="/v1/storage/objects/";
  if(request.method==="GET"&&url.pathname.startsWith(listPrefix)){
    try{
      const bucket=normalizeBucketName(decodeURIComponent(url.pathname.slice(listPrefix.length)));
      const prefix=url.searchParams.get("prefix")||"";
      const normalizedPrefix=prefix?normalizeObjectKey(prefix):"";
      const objects=await store.listObjects({ownerId:claims.sub,bucket,prefix:normalizedPrefix});
      return json({ok:true,objects});
    }catch{
      return json({ok:false,error:"invalid_storage_query"},400);
    }
  }

  return json({ok:false,error:"storage_route_not_found"},404);
}
