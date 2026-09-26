import {signJwtHs256} from "./auth-core.mjs";

function requiredOrigin(value){
  const url=new URL(String(value||""));
  if(!["http:","https:"].includes(url.protocol))throw new TypeError("PostgREST URL is invalid");
  return url.origin;
}

function rows(body){
  return Array.isArray(body)?body:[];
}

export function createPostgrestStorageStore({
  postgrestUrl,
  jwtSecret,
  fetchImpl=globalThis.fetch,
}={}){
  const origin=requiredOrigin(postgrestUrl);
  if(typeof fetchImpl!=="function")throw new TypeError("fetch implementation is required");

  function serviceToken(){
    return signJwtHs256({
      sub:"hercules-base-storage-service",
      role:"staging_storage",
      issuer:"hercules-base-internal",
      audience:"hercules-base-postgrest",
      ttlSeconds:300,
    },jwtSecret);
  }

  async function rpc(name,payload){
    const response=await fetchImpl(origin+"/rpc/"+name,{
      method:"POST",
      headers:{
        "content-type":"application/json",
        authorization:"Bearer "+serviceToken(),
      },
      body:JSON.stringify(payload),
      signal:AbortSignal.timeout(5000),
    });
    const text=await response.text();
    let body=null;
    if(text){
      try{body=JSON.parse(text);}catch{body={message:text};}
    }
    if(!response.ok){
      const error=new Error(body?.message||"STORAGE_STORE_ERROR");
      error.status=response.status;
      throw error;
    }
    return body;
  }

  return Object.freeze({
    async createBucket({id,ownerId,name}){
      return rows(await rpc("storage_create_bucket",{
        p_id:id,
        p_owner_id:ownerId,
        p_name:name,
      }))[0]??null;
    },

    async putObject({id,ownerId,bucket,objectKey,sha256,sizeBytes,contentType}){
      return rows(await rpc("storage_put_object",{
        p_id:id,
        p_owner_id:ownerId,
        p_bucket:bucket,
        p_object_key:objectKey,
        p_sha256:sha256,
        p_size_bytes:sizeBytes,
        p_content_type:contentType,
      }))[0]??null;
    },

    async getObject({ownerId,bucket,objectKey}){
      return rows(await rpc("storage_get_object",{
        p_owner_id:ownerId,
        p_bucket:bucket,
        p_object_key:objectKey,
      }))[0]??null;
    },

    async deleteObject({ownerId,bucket,objectKey}){
      return rows(await rpc("storage_delete_object",{
        p_owner_id:ownerId,
        p_bucket:bucket,
        p_object_key:objectKey,
      }))[0]??null;
    },

    async listObjects({ownerId,bucket,prefix=""}){
      return rows(await rpc("storage_list_objects",{
        p_owner_id:ownerId,
        p_bucket:bucket,
        p_prefix:prefix,
      }));
    },
  });
}
