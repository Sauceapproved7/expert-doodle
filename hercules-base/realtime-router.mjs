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
  const reader=request.body?.getReader();
  const decoder=new TextDecoder();
  let total=0;
  let text="";
  if(reader){
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>maxBytes){
        try{await reader.cancel();}catch{}
        const error=new Error("request body too large");
        error.status=413;
        throw error;
      }
      text+=decoder.decode(value,{stream:true});
    }
    text+=decoder.decode();
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
  return {channel:normalizeRealtimeChannel(channelRaw),tail:rest.slice(slash+1)};
}

function sleep(ms,signal){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const cleanup=()=>signal?.removeEventListener("abort",onAbort);
    const finish=(fn,value)=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      cleanup();
      fn(value);
    };
    const onAbort=()=>finish(reject,signal.reason||new Error("aborted"));
    const timer=setTimeout(()=>finish(resolve),ms);
    if(signal){
      if(signal.aborted)return onAbort();
      signal.addEventListener("abort",onAbort,{once:true});
    }
  });
}

function streamResponse({
  store,
  ownerId,
  channel,
  afterId,
  requestSignal,
  pollIntervalMs=750,
  heartbeatMs=15000,
}){
  const encoder=new TextEncoder();
  const lifecycle=new AbortController();
  let cursor=afterId;
  let lastWrite=Date.now();
  let cancelled=false;

  if(requestSignal){
    if(requestSignal.aborted)lifecycle.abort(requestSignal.reason);
    else requestSignal.addEventListener("abort",()=>lifecycle.abort(requestSignal.reason),{once:true});
  }

  async function nextChunk(){
    while(!lifecycle.signal.aborted){
      const events=await store.poll({
        ownerId,
        channel,
        afterId:cursor,
        limit:100,
        signal:lifecycle.signal,
      });

      if(events.length){
        let text="";
        for(const item of events){
          text+=encodeSseEvent({
            id:Number(item.id),
            event:item.event_name,
            data:item.payload,
          });
          cursor=Number(item.id);
        }
        lastWrite=Date.now();
        return encoder.encode(text);
      }

      if(Date.now()-lastWrite>=heartbeatMs){
        lastWrite=Date.now();
        return encoder.encode(": pulse\n\n");
      }
      await sleep(pollIntervalMs,lifecycle.signal);
    }
    return null;
  }

  const body=new ReadableStream({
    async pull(controller){
      if(cancelled||lifecycle.signal.aborted){
        try{controller.close();}catch{}
        return;
      }
      try{
        const chunk=await nextChunk();
        if(cancelled||lifecycle.signal.aborted){
          try{controller.close();}catch{}
          return;
        }
        if(chunk)controller.enqueue(chunk);
      }catch(error){
        if(cancelled||lifecycle.signal.aborted){
          try{controller.close();}catch{}
        }else{
          controller.error(error);
        }
      }
    },
    cancel(){
      cancelled=true;
      lifecycle.abort(new Error("stream_cancelled"));
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
  streamPollIntervalMs=750,
  streamHeartbeatMs=15000,
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
      const channel=await store.createChannel({id:randomUUID(),ownerId:claims.sub,name});
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
        const event=await store.publish({
          ownerId:claims.sub,
          channel:parsed.channel,
          eventName,
          payload:body.data??null,
        });
        return json({ok:true,event},201);
      }catch(error){
        const status=error?.status===413?413:400;
        return json({ok:false,error:status===413?"event_too_large":"realtime_publish_failed"},status);
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
          signal:request.signal,
        });
        return json({ok:true,events,next_after:events.length?Number(events.at(-1).id):afterId});
      }catch{
        return json({ok:false,error:"invalid_realtime_query"},400);
      }
    }
  }

  if(parsed?.tail==="stream"&&request.method==="GET"){
    try{
      const afterId=normalizeRealtimeCursor(
        url.searchParams.get("after")??request.headers.get("last-event-id"),
      );
      return streamResponse({
        store,
        ownerId:claims.sub,
        channel:parsed.channel,
        afterId,
        requestSignal:request.signal,
        pollIntervalMs:streamPollIntervalMs,
        heartbeatMs:streamHeartbeatMs,
      });
    }catch{
      return json({ok:false,error:"invalid_realtime_cursor"},400);
    }
  }

  return json({ok:false,error:"realtime_route_not_found"},404);
}
