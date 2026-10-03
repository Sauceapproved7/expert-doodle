import assert from "node:assert/strict";
import test from "node:test";
import {HerculesHuggingFaceZeroGpuAdapter,__test} from "../hercules-video/huggingface-zerogpu-adapter.mjs";

const request={
  schema:"sauceapproved.hercules.video-render-request",
  version:1,
  projectId:"studio-proof",
  shot:{id:"shot-1",prompt:"SauceApproved proof",durationSeconds:2,aspectRatio:"9:16",requiresAudio:false,audioStrategy:"none",continuityGroup:null},
  output:{resolution:"720p",fps:24,container:"mp4"},
  references:[],modelRef:"Wan-AI/Wan2.2-TI2V-5B-Diffusers",seed:7,
  requestFingerprint:"a".repeat(64)
};

function response({status=200,json,text,headers={}}={}) {
  return {
    ok:status>=200&&status<300,status,
    async json(){return json??{}},
    async text(){return text??""},
    headers:{get(name){return headers[String(name).toLowerCase()]??null}}
  };
}

test("ZeroGPU adapter accepts only hf.space HTTPS endpoints",()=>{
  assert.throws(()=>new HerculesHuggingFaceZeroGpuAdapter({spaceUrl:"http://example.com"}),/zerogpu_space_url_invalid/);
  const a=new HerculesHuggingFaceZeroGpuAdapter({spaceUrl:"https://sauceapproved-video.hf.space"});
  assert.equal(a.descriptor.provider,"huggingface");
  assert.equal(a.descriptor.runtime,"zerogpu");
});

test("health verifies the configured Gradio endpoint",async()=>{
  const calls=[];
  const fetchImpl=async(url,init)=>{calls.push([url,init]);return response({json:{paths:{"/gradio_api/call/generate":{post:{}}}}})};
  const a=new HerculesHuggingFaceZeroGpuAdapter({spaceUrl:"https://sauceapproved-video.hf.space",fetchImpl});
  const h=await a.health();
  assert.equal(h.ok,true);
  assert.match(calls[0][0],/openapi\.json$/);
});

test("generate submits only the canonical Hercules render request",async()=>{
  let sent=null;
  const fetchImpl=async(_url,init)=>{sent=JSON.parse(init.body);return response({json:{event_id:"evt-1"}})};
  const a=new HerculesHuggingFaceZeroGpuAdapter({spaceUrl:"https://sauceapproved-video.hf.space",fetchImpl});
  const x=await a.generate(request);
  assert.equal(x.remoteJobId,"evt-1");
  assert.deepEqual(JSON.parse(sent.data[0]),request);
  await assert.rejects(()=>a.generate({...request,requestFingerprint:null}),/render_request_fingerprint_required/);
});

test("status parses completed Gradio SSE into evidence-bearing artifact",async()=>{
  const sse=[
    "event: complete",
    'data: [{"url":"https://sauceapproved-video.hf.space/gradio_api/file=/tmp/out.mp4"},{"sha256":"'+("b".repeat(64))+'","sizeBytes":1234,"width":704,"height":1280,"durationSeconds":2,"fps":24,"modelRef":"Wan-AI/Wan2.2-TI2V-5B-Diffusers","seed":7,"requestFingerprint":"'+request.requestFingerprint+'"}]',
    "",
  ].join("\n");
  const fetchImpl=async()=>response({text:sse,headers:{"content-type":"text/event-stream"}});
  const a=new HerculesHuggingFaceZeroGpuAdapter({spaceUrl:"https://sauceapproved-video.hf.space",fetchImpl});
  const x=await a.status("evt-1");
  assert.equal(x.status,"completed");
  assert.equal(x.artifact.sha256,"b".repeat(64));
  assert.equal(x.artifact.providerEvidence.requestFingerprint,request.requestFingerprint);
});

test("token stays out of public descriptor and request payload",async()=>{
  const calls=[];
  const fetchImpl=async(url,init)=>{calls.push([url,init]);return response({json:{event_id:"evt-2"}})};
  const a=new HerculesHuggingFaceZeroGpuAdapter({spaceUrl:"https://sauceapproved-video.hf.space",token:"hf_private_test",fetchImpl});
  await a.generate(request);
  assert.equal(JSON.stringify(a.descriptor).includes("hf_private_test"),false);
  assert.equal(JSON.stringify(calls[0][1].body).includes("hf_private_test"),false);
  assert.equal(calls[0][1].headers.authorization,"Bearer hf_private_test");
});

test("SSE parser remains fail-closed on incomplete jobs",()=>{
  assert.deepEqual(__test.parseComplete(__test.parseSse("event: status\ndata: {\"msg\":\"pending\"}\n\n")),{status:"running"});
});
