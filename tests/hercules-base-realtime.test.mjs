import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";

import {
  normalizeRealtimeChannel,
  normalizeRealtimeEvent,
  encodeSseEvent,
} from "../hercules-base/realtime-core.mjs";

function fixtureJwtSecret(){
  return randomBytes(48).toString("hex");
}

test("Pulse validates portable channel and event names", () => {
  assert.equal(normalizeRealtimeChannel("orders-live"),"orders-live");
  assert.equal(normalizeRealtimeEvent("order.updated"),"order.updated");
  assert.throws(()=>normalizeRealtimeChannel("../escape"),/channel/i);
  assert.throws(()=>normalizeRealtimeChannel("A SPACE"),/channel/i);
  assert.throws(()=>normalizeRealtimeEvent("event\nname"),/event/i);
});

test("Pulse SSE encoding is deterministic and injection-safe", () => {
  const encoded=encodeSseEvent({
    id:42,
    event:"order.updated",
    data:{orderId:"o_1",status:"paid"},
  });
  assert.equal(
    encoded,
    'id: 42\nevent: order.updated\ndata: {"orderId":"o_1","status":"paid"}\n\n',
  );
  assert.equal(encoded.includes("\r"),false);
});

test("Pulse migration keeps realtime state private behind server-only RPCs", async () => {
  const {readFile}=await import("node:fs/promises");
  const sql=await readFile(
    new URL("../staging-plane/migrations/004_base_realtime.sql",import.meta.url),
    "utf8",
  );

  assert.match(sql,/create role staging_realtime noinherit nologin/i);
  assert.match(sql,/create table(?: if not exists)? staging_api\.realtime_channels/i);
  assert.match(sql,/create table(?: if not exists)? staging_api\.realtime_events/i);
  assert.match(sql,/owner_id uuid not null/i);
  assert.match(sql,/event_name text not null/i);
  assert.match(sql,/payload jsonb not null/i);
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on staging_api\.realtime_channels from public/i);
  assert.match(sql,/revoke all on staging_api\.realtime_events from public/i);
  assert.match(sql,/grant execute on function staging_api\.realtime_create_channel/i);
  assert.match(sql,/grant execute on function staging_api\.realtime_publish/i);
  assert.match(sql,/grant execute on function staging_api\.realtime_poll/i);
});

test("Pulse publish binds ownership to the authenticated JWT subject", async () => {
  const {routeRealtimeRequest}=await import("../hercules-base/realtime-router.mjs");
  const {signJwtHs256}=await import("../hercules-base/auth-core.mjs");
  const jwtSecret=fixtureJwtSecret();
  const userId="11111111-1111-4111-8111-111111111111";
  const token=signJwtHs256({
    sub:userId,
    role:"staging_user",
    issuer:"hercules-base",
    audience:"hercules-base-api",
    ttlSeconds:900,
  },jwtSecret);

  let recorded=null;
  const store={
    async publish(input){
      recorded=input;
      return {
        id:7,
        channel:"orders-live",
        event_name:"order.updated",
        payload:input.payload,
      };
    },
  };

  const response=await routeRealtimeRequest(
    new Request("https://base.local/v1/realtime/channels/orders-live/events",{
      method:"POST",
      headers:{
        authorization:"Bearer "+token,
        "content-type":"application/json",
      },
      body:JSON.stringify({
        event:"order.updated",
        data:{orderId:"o_1"},
      }),
    }),
    {jwtSecret,store},
  );

  assert.equal(response.status,201);
  assert.equal(recorded.ownerId,userId);
  assert.equal(recorded.channel,"orders-live");
  assert.equal(recorded.eventName,"order.updated");
  assert.deepEqual(recorded.payload,{orderId:"o_1"});
});

test("Pulse rejects unauthenticated, oversized, and invalid event input", async () => {
  const {routeRealtimeRequest}=await import("../hercules-base/realtime-router.mjs");
  const {signJwtHs256}=await import("../hercules-base/auth-core.mjs");
  const jwtSecret=fixtureJwtSecret();
  const userId="11111111-1111-4111-8111-111111111111";
  const token=signJwtHs256({
    sub:userId,
    role:"staging_user",
    issuer:"hercules-base",
    audience:"hercules-base-api",
    ttlSeconds:900,
  },jwtSecret);
  let writes=0;
  const store={async publish(){writes++;}};

  const unauth=await routeRealtimeRequest(
    new Request("https://base.local/v1/realtime/channels/orders-live/events",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({event:"order.updated",data:{}}),
    }),
    {jwtSecret,store},
  );
  assert.equal(unauth.status,401);

  const oversized=await routeRealtimeRequest(
    new Request("https://base.local/v1/realtime/channels/orders-live/events",{
      method:"POST",
      headers:{
        authorization:"Bearer "+token,
        "content-type":"application/json",
      },
      body:JSON.stringify({event:"order.updated",data:{x:"x".repeat(20000)}}),
    }),
    {jwtSecret,store,maxEventBytes:4096},
  );
  assert.equal(oversized.status,413);
  assert.equal(writes,0);
});

test("Pulse polling requests are user-scoped and cursor-bounded", async () => {
  const {routeRealtimeRequest}=await import("../hercules-base/realtime-router.mjs");
  const {signJwtHs256}=await import("../hercules-base/auth-core.mjs");
  const jwtSecret=fixtureJwtSecret();
  const userId="11111111-1111-4111-8111-111111111111";
  const token=signJwtHs256({
    sub:userId,
    role:"staging_user",
    issuer:"hercules-base",
    audience:"hercules-base-api",
    ttlSeconds:900,
  },jwtSecret);

  let recorded=null;
  const store={
    async poll(input){
      recorded=input;
      return [{
        id:12,
        event_name:"order.updated",
        payload:{orderId:"o_1"},
        created_at:"2026-09-26T20:00:00Z",
      }];
    },
  };

  const response=await routeRealtimeRequest(
    new Request("https://base.local/v1/realtime/channels/orders-live/events?after=9&limit=50",{
      headers:{authorization:"Bearer "+token},
    }),
    {jwtSecret,store},
  );
  assert.equal(response.status,200);
  assert.equal(recorded.ownerId,userId);
  assert.equal(recorded.afterId,9);
  assert.equal(recorded.limit,50);
  const body=await response.json();
  assert.equal(body.events[0].id,12);
});

test("server bridge streams Response bodies without buffering whole SSE responses", async () => {
  const {writeFetchResponse}=await import("../hercules-base/response-bridge.mjs");
  const chunks=[];
  const fakeNodeResponse={
    statusCode:0,
    headers:{},
    setHeader(name,value){this.headers[name]=value;},
    write(chunk){chunks.push(Buffer.from(chunk));return true;},
    end(chunk){if(chunk)chunks.push(Buffer.from(chunk));this.ended=true;},
    once(){},
  };
  const response=new Response(new ReadableStream({
    start(controller){
      controller.enqueue(new TextEncoder().encode("data: one\n\n"));
      controller.enqueue(new TextEncoder().encode("data: two\n\n"));
      controller.close();
    },
  }),{
    status:200,
    headers:{"content-type":"text/event-stream"},
  });

  await writeFetchResponse(fakeNodeResponse,response);
  assert.equal(fakeNodeResponse.statusCode,200);
  assert.equal(Buffer.concat(chunks).toString(),"data: one\n\ndata: two\n\n");
  assert.equal(fakeNodeResponse.ended,true);
});


test("Pulse stops undeclared oversized event bodies while streaming", async () => {
  const {routeRealtimeRequest}=await import("../hercules-base/realtime-router.mjs");
  const {signJwtHs256}=await import("../hercules-base/auth-core.mjs");
  const jwtSecret=fixtureJwtSecret();
  const token=signJwtHs256({
    sub:"11111111-1111-4111-8111-111111111111",
    role:"staging_user",
    issuer:"hercules-base",
    audience:"hercules-base-api",
    ttlSeconds:900,
  },jwtSecret);
  let pulls=0;
  const body=new ReadableStream({
    pull(controller){
      pulls+=1;
      if(pulls===1)return controller.enqueue(new TextEncoder().encode('{"event":"x","data":"'));
      if(pulls===2)return controller.enqueue(new TextEncoder().encode("xxxxxxxxxxxxxxxx"));
      throw new Error("Pulse reader pulled past the rejection boundary");
    },
  });
  const response=await routeRealtimeRequest(
    new Request("https://base.local/v1/realtime/channels/orders-live/events",{
      method:"POST",
      headers:{authorization:"Bearer "+token,"content-type":"application/json"},
      body,
      duplex:"half",
    }),
    {jwtSecret,store:{async publish(){throw new Error("must not publish");}},maxEventBytes:24},
  );
  assert.equal(response.status,413);
  assert.equal(pulls,2);
});

test("Pulse SSE honors backpressure and stops polling after cancellation", async () => {
  const {routeRealtimeRequest}=await import("../hercules-base/realtime-router.mjs");
  const {signJwtHs256}=await import("../hercules-base/auth-core.mjs");
  const jwtSecret=fixtureJwtSecret();
  const token=signJwtHs256({
    sub:"11111111-1111-4111-8111-111111111111",
    role:"staging_user",
    issuer:"hercules-base",
    audience:"hercules-base-api",
    ttlSeconds:900,
  },jwtSecret);
  let polls=0;
  const store={
    async poll(){
      polls+=1;
      return [{id:polls,event_name:"pulse.event",payload:{polls}}];
    },
  };
  const response=await routeRealtimeRequest(
    new Request("https://base.local/v1/realtime/channels/orders-live/stream",{
      headers:{authorization:"Bearer "+token},
    }),
    {jwtSecret,store,streamPollIntervalMs:10,streamHeartbeatMs:1000},
  );
  await new Promise((resolve)=>setTimeout(resolve,60));
  assert.equal(polls,1);
  await response.body.cancel();
  await new Promise((resolve)=>setTimeout(resolve,30));
  assert.equal(polls,1);
});

test("Base server aborts realtime work when the client connection closes", async () => {
  const {readFile}=await import("node:fs/promises");
  const source=await readFile(new URL("../hercules-base/server.mjs",import.meta.url),"utf8");
  assert.match(source,/new AbortController\(\)/);
  assert.match(source,/response\.once\("close",\(\)=>abortController\.abort\(\)\)/);
  assert.match(source,/writeFetchResponse\(response,routed\)/);
});
