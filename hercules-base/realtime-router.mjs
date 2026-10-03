import {randomUUID} from "node:crypto";
import {verifyJwtHs256} from "./auth-core.mjs";
import {
  encodeSseEvent,
  normalizeRealtimeChannel,
  normalizeRealtimeCursor,
  normalizeRealtimeEvent,
  normalizeRealtimeLimit,
} from "./realtime-core.mjs";

const DEFAULT_EVENT_BYTES=16*1024;

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

async function readJsonBounded(request,maxBytes){
  const declared=Number(request.headers.get("content-length"));
  if(Number.isFinite(declared)&&declared>maxBytes){
    const error=new Error("request body too large");
    error.status=413;
    throw error;
  }
  const text=await request.text();
  if(new TextEncoder().encode(text).byteLength>maxBytes){
    const error=new Error("request body too large");
    error.status=413;
    throw error;
  }
  try{return JSON.parse(text||"{}");}
  catch{throw new TypeError("invalid JSON");}
}

function parseChannelRoute(pathname){
  const prefix="/v1/realtime/channels/";
  if(!pathname.startsWith(prefix))return null;
  const rest=pathname.slice(prefix.length);
  const slash=rest.indexOf("/");
  if(slash<1)return null;
  let channelRaw=rest.slice(0,slash);
  try{channelRaw=decodeURIComponent(channelRaw);}catch{throw new TypeError("channel is invalid");}
  const tail=rest.slice(slash+1);
  return {
    channel:normalizeRealtimeChannel(channelRaw),
    tail,
  };
}

function sleep(ms,signal){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(resolve,ms);
    if(signal){
      if(signal.aborted){
        clearTimeout(timer);
        reject(signal.reason||new Error("aborted"));
        return;
      }
      signal.addEventListener("abort",()=>{
        clearTimeout(timer);
        reject(signal.reason||new Error("aborted"));
      },{once:true});
    }
  });
}

function streamResponse({
  store,
  ownerId,
  channel,
  afterId,
  signal,
  pollIntervalMs=750,
  heartbeatMs=15000,
}){
  const encoder=new TextEncoder();
  let cursor=afterId;
  let lastWrite=Date.now();

  const body=new ReadableStream({
    async start(controller){
      try{
        while(!signal?.aborted){
          const events=await store.poll({
            ownerId,
            channel,
            afterId:cursor,
            limit:100,
          });

          if(events.length){
            for(const item of events){
              controller.enqueue(encoder.encode(encodeSseEvent({
                id:Number(item.id),
                event:item.event_name,
                data:item.payload,
              })));
              cursor=Number(item.id);
              lastWrite=Date.now();
            }
          }else if(Date.now()-lastWrite>=heartbeatMs){
            controller.enqueue(encoder.encode(": pulse\n\n"));
            lastWrite=Date.now();
          }

          await sleep(pollIntervalMs,signal);
        }
      }catch(error){
        if(!signal?.aborted)controller.error(error);
      }finally{
        try{controller.close();}catch{}
      }
    },
    cancel(){
      // Request abort owns stream cancellation.
    },
  });

  return new Response(body,{
    status:200,
    headers:{
      "content-type":"text/event-stream; charset=utf-8",
      "cache-control":"no-store",
      "connection":"keep-alive",
      "x-accel-buffering":"no",
      "x-content-type-options":"nosniff",
    },
  });
}

export async function routeRealtimeRequest(request,{
  jwtSecret,
  store,
  maxEventBytes=DEFAULT_EVENT_BYTES,
}={}){
  if(!store)return json({ok:false,error:"realtime_unavailable"},503);

  let claims;
  try{claims=authenticate(request,jwtSecret);}
  catch{return json({ok:false,error:"unauthorized"},401);}

  const url=new URL(request.url);

  if(request.method==="POST"&&url.pathname==="/v1/realtime/channels"){
    try{
      const body=await readJsonBounded(request,4096);
      const name=normalizeRealtimeChannel(body.name);
      const channel=await store.createChannel({
        id:randomUUID(),
        ownerId:claims.sub,
        name,
      });
      return json({ok:true,channel},201);
    }catch(error){
      return json(
        {ok:false,error:error?.status===413?"request_body_too_large":"invalid_channel"},
        error?.status||400,
      );
    }
  }

  let parsed;
  try{parsed=parseChannelRoute(url.pathname);}
  catch{return json({ok:false,error:"invalid_realtime_path"},400);}

  if(parsed?.tail==="events"){
    if(request.method==="POST"){
      try{
        const body=await readJsonBounded(request,maxEventBytes);
        const eventName=normalizeRealtimeEvent(body.event);
        const payload=body.data??null;
        const event=await store.publish({
          ownerId:claims.sub,
          channel:parsed.channel,
          eventName,
          payload,
        });
        return json({ok:true,event},201);
      }catch(error){
        const status=error?.status===413?413:400;
        return json({
          ok:false,
          error:status===413?"event_too_large":"realtime_publish_failed",
        },status);
      }
    }

    if(request.method==="GET"){
      try{
        const afterId=normalizeRealtimeCursor(url.searchParams.get("after"));
        const limit=normalizeRealtimeLimit(url.searchParams.get("limit"));
        const events=await store.poll({
          ownerId:claims.sub,
          channel:parsed.channel,
          afterId,
          limit,
        });
        return json({ok:true,events,next_after:events.length?Number(events.at(-1).id):afterId});
      }catch{
        return json({ok:false,error:"invalid_realtime_query"},400);
      }
    }
  }

  if(parsed?.tail==="stream"&&request.method==="GET"){
    try{
      const headerCursor=request.headers.get("last-event-id");
      const afterId=normalizeRealtimeCursor(
        url.searchParams.get("after")??headerCursor,
      );
      return streamResponse({
        store,
        ownerId:claims.sub,
        channel:parsed.channel,
        afterId,
        signal:request.signal,
      });
    }catch{
      return json({ok:false,error:"invalid_realtime_cursor"},400);
    }
  }

  return json({ok:false,error:"realtime_route_not_found"},404);
}
