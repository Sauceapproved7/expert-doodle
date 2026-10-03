import {randomBytes} from "node:crypto";

const baseUrl=process.env.HERCULES_BASE_STAGING_URL||"http://127.0.0.1:38800";

function assert(condition,message){
  if(!condition)throw new Error(message);
}

async function jsonRequest(path,{method="GET",body,token}={}){
  const headers={};
  if(body!==undefined)headers["content-type"]="application/json";
  if(token)headers.authorization="Bearer "+token;
  const response=await fetch(baseUrl+path,{
    method,
    headers,
    body:body===undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(10000),
  });
  let data={};
  try{data=await response.json();}catch{}
  return {response,data};
}

async function createFixtureUser(label){
  const suffix=randomBytes(8).toString("hex");
  const email=label+"-"+suffix+"@fixture.invalid";
  const password=randomBytes(24).toString("base64url");
  const signup=await jsonRequest("/v1/auth/signup",{
    method:"POST",
    body:{email,password},
  });
  assert(signup.response.status===201,label+"_signup_failed");
  assert(typeof signup.data?.access_token==="string",label+"_token_missing");
  return {token:signup.data.access_token};
}

async function publish(channel,token,event,data){
  return jsonRequest("/v1/realtime/channels/"+channel+"/events",{
    method:"POST",
    token,
    body:{event,data},
  });
}

const suffix=randomBytes(6).toString("hex");
const channel="orders-"+suffix;
const owner=await createFixtureUser("pulse-owner");
const outsider=await createFixtureUser("pulse-outsider");

const created=await jsonRequest("/v1/realtime/channels",{
  method:"POST",
  token:owner.token,
  body:{name:channel},
});
assert(created.response.status===201,"pulse_channel_create_failed");

const first=await publish(channel,owner.token,"order.created",{orderId:"o1",status:"created"});
assert(first.response.status===201,"pulse_first_publish_failed");
const firstId=Number(first.data?.event?.id);
assert(Number.isSafeInteger(firstId)&&firstId>0,"pulse_first_id_missing");

const second=await publish(channel,owner.token,"order.updated",{orderId:"o1",status:"paid"});
assert(second.response.status===201,"pulse_second_publish_failed");
const secondId=Number(second.data?.event?.id);
assert(secondId>firstId,"pulse_sequence_not_monotonic");

const replayAll=await jsonRequest(
  "/v1/realtime/channels/"+channel+"/events?after=0&limit=100",
  {token:owner.token},
);
assert(replayAll.response.status===200,"pulse_replay_failed");
assert(
  Array.isArray(replayAll.data?.events)&&
  replayAll.data.events.some((event)=>Number(event.id)===firstId)&&
  replayAll.data.events.some((event)=>Number(event.id)===secondId),
  "pulse_replay_missing_events",
);

const replayAfterFirst=await jsonRequest(
  "/v1/realtime/channels/"+channel+"/events?after="+firstId+"&limit=100",
  {token:owner.token},
);
assert(replayAfterFirst.response.status===200,"pulse_cursor_replay_failed");
assert(
  replayAfterFirst.data.events.length===1&&
  Number(replayAfterFirst.data.events[0].id)===secondId,
  "pulse_cursor_replay_wrong_event",
);

const outsiderRead=await jsonRequest(
  "/v1/realtime/channels/"+channel+"/events?after=0&limit=100",
  {token:outsider.token},
);
assert(outsiderRead.response.status===200,"pulse_outsider_poll_failed");
assert(Array.isArray(outsiderRead.data?.events)&&outsiderRead.data.events.length===0,"pulse_cross_user_read_allowed");

const outsiderPublish=await publish(
  channel,
  outsider.token,
  "order.updated",
  {orderId:"o1",status:"stolen"},
);
assert(outsiderPublish.response.status===400,"pulse_cross_user_publish_allowed");

const third=await publish(channel,owner.token,"order.shipped",{orderId:"o1",status:"shipped"});
assert(third.response.status===201,"pulse_third_publish_failed");
const thirdId=Number(third.data?.event?.id);
assert(thirdId>secondId,"pulse_third_sequence_not_monotonic");

const controller=new AbortController();
const streamResponse=await fetch(
  baseUrl+"/v1/realtime/channels/"+channel+"/stream?after="+secondId,
  {
    headers:{authorization:"Bearer "+owner.token},
    signal:controller.signal,
  },
);
assert(streamResponse.status===200,"pulse_stream_open_failed");
assert(
  (streamResponse.headers.get("content-type")||"").startsWith("text/event-stream"),
  "pulse_stream_content_type_wrong",
);

const reader=streamResponse.body.getReader();
let streamText="";
try{
  while(!streamText.includes("\n\n")){
    const {done,value}=await reader.read();
    if(done)break;
    streamText+=Buffer.from(value).toString("utf8");
  }
}finally{
  controller.abort();
  try{await reader.cancel();}catch{}
}

assert(streamText.includes("id: "+thirdId+"\n"),"pulse_stream_event_id_missing");
assert(streamText.includes("event: order.shipped\n"),"pulse_stream_event_name_missing");
assert(streamText.includes('"status":"shipped"'),"pulse_stream_payload_missing");

console.log(JSON.stringify({
  ok:true,
  product:"Hercules Base Pulse",
  flow:"channel-publish-replay-isolate-stream",
  monotonicIds:true,
  replayCursorVerified:true,
  crossUserIsolationVerified:true,
  sseVerified:true,
  fixture:true,
}));
