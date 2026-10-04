import {signJwtHs256} from "./auth-core.mjs";

function originOf(value){
  const url=new URL(String(value||""));
  if(!["http:","https:"].includes(url.protocol))throw new TypeError("PostgREST URL is invalid");
  return url.origin;
}

function rows(value){
  return Array.isArray(value)?value:[];
}

export function createPostgrestFunctionsStore({
  postgrestUrl,
  jwtSecret,
  fetchImpl=globalThis.fetch,
}={}){
  const origin=originOf(postgrestUrl);
  if(typeof fetchImpl!=="function")throw new TypeError("fetch implementation is required");

  function serviceToken(){
    return signJwtHs256({
      sub:"hercules-base-functions-service",
      role:"staging_functions",
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
      const error=new Error(body?.message||"FUNCTIONS_STORE_ERROR");
      error.status=response.status;
      throw error;
    }
    return body;
  }

  return Object.freeze({
    async register({id,ownerId,manifest,fingerprint}){
      return rows(await rpc("functions_register",{
        p_id:id,
        p_owner_id:ownerId,
        p_name:manifest.name,
        p_runtime:manifest.runtime,
        p_entrypoint:manifest.entrypoint,
        p_timeout_ms:manifest.timeoutMs,
        p_memory_mb:manifest.memoryMb,
        p_network_policy:manifest.network,
        p_source_sha256:manifest.sourceSha256,
        p_fingerprint:fingerprint,
      }))[0]??null;
    },

    async get({ownerId,name}){
      return rows(await rpc("functions_get",{
        p_owner_id:ownerId,
        p_name:name,
      }))[0]??null;
    },

    async list({ownerId}){
      return rows(await rpc("functions_list",{p_owner_id:ownerId}));
    },
  });
}
