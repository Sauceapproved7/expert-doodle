import {signJwtHs256} from "./auth-core.mjs";

function requiredOrigin(value){
  const url=new URL(String(value||""));
  if(!["http:","https:"].includes(url.protocol))throw new TypeError("PostgREST URL is invalid");
  return url.origin;
}

function rows(body){
  return Array.isArray(body)?body:[];
}

export function createPostgrestRealtimeStore({
  postgrestUrl,
  jwtSecret,
  fetchImpl=globalThis.fetch,
}={}){
  const origin=requiredOrigin(postgrestUrl);
  if(typeof fetchImpl!=="function")throw new TypeError("fetch implementation is required");

  function serviceToken(){
    return signJwtHs256({
      sub:"hercules-base-realtime-service",
      role:"staging_realtime",
      issuer:"hercules-base-internal",
      audience:"hercules-base-postgrest",
      ttlSeconds:300,
    },jwtSecret);
  }

  async function rpc(name,payload,{signal}={}){
    const response=await fetchImpl(origin+"/rpc/"+name,{
      method:"POST",
      headers:{
        "content-type":"application/json",
        authorization:"Bearer "+serviceToken(),
      },
      body:JSON.stringify(payload),
      signal:signal?AbortSignal.any([signal,AbortSignal.timeout(5000)]):AbortSignal.timeout(5000),
    });
    const text=await response.text();
    let body=null;
    if(text){
      try{body=JSON.parse(text);}catch{body={message:text};}
    }
    if(!response.ok){
      const error=new Error(body?.message||"REALTIME_STORE_ERROR");
      error.status=response.status;
      throw error;
    }
    return body;
  }

  return Object.freeze({
    async createChannel({id,ownerId,name}){
      return rows(await rpc("realtime_create_channel",{
        p_id:id,
        p_owner_id:ownerId,
        p_name:name,
      }))[0]??null;
    },

    async publish({ownerId,channel,eventName,payload}){
      return rows(await rpc("realtime_publish",{
        p_owner_id:ownerId,
        p_channel:channel,
        p_event_name:eventName,
        p_payload:payload,
      }))[0]??null;
    },

    async poll({ownerId,channel,afterId=0,limit=100,signal}){
      return rows(await rpc("realtime_poll",{
        p_owner_id:ownerId,
        p_channel:channel,
        p_after_id:afterId,
        p_limit:limit,
      },{signal}));
    },
  });
}
