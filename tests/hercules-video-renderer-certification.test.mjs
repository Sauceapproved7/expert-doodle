import assert from "node:assert/strict";
import test from "node:test";
import {certifyHerculesVideoRenderer} from "../hercules-video/renderer-certification.mjs";

const request={
  schema:"sauceapproved.hercules.video-render-request",
  version:1,
  projectId:"renderer-cert-proof",
  shot:{id:"proof-1",prompt:"SauceApproved certification proof",durationSeconds:2,aspectRatio:"9:16",requiresAudio:false,audioStrategy:"none",continuityGroup:null},
  output:{resolution:"720p",fps:24,container:"mp4"},
  references:[],modelRef:"Wan-AI/Wan2.2-TI2V-5B-Diffusers",seed:7,
  requestFingerprint:"a".repeat(64)
};

function healthyAdapter(overrides={}){
  let polls=0;
  return {
    descriptor:{id:"test-renderer",label:"Test Renderer",kind:"external-renderer",provider:"test",runtime:"gpu"},
    async health(){return {ok:true,status:200}},
    async generate(){return {status:"queued",remoteJobId:"remote-1",requestFingerprint:request.requestFingerprint}},
    async status(){
      polls++;
      return polls<2?{status:"running"}:{
        status:"completed",
        artifact:{
          uri:"https://renderer.example/out.mp4",
          mimeType:"video/mp4",
          sizeBytes:2048,
          sha256:"b".repeat(64),
          width:704,height:1280,durationSeconds:2,fps:24,
          providerEvidence:{requestFingerprint:request.requestFingerprint,modelRef:request.modelRef,seed:7}
        }
      };
    },
    async inspect(){return {ok:true,status:200,contentType:"video/mp4",contentLength:2048}},
    ...overrides
  };
}

test("certifies only after health, completed render, artifact evidence, and inspect pass",async()=>{
  const result=await certifyHerculesVideoRenderer({
    adapter:healthyAdapter(),
    request,
    maxPolls:3,
    pollIntervalMs:0,
    now:()=>new Date("2026-09-28T09:40:00Z")
  });
  assert.equal(result.certified,true);
  assert.equal(result.requestFingerprint,request.requestFingerprint);
  assert.equal(result.artifact.sha256,"b".repeat(64));
  assert.equal(result.inspect.ok,true);
  assert.match(result.certificationFingerprint,/^[a-f0-9]{64}$/);
});

test("fails closed on unhealthy renderer before generation",async()=>{
  let generated=false;
  const adapter=healthyAdapter({
    async health(){return {ok:false,status:503}},
    async generate(){generated=true;return {status:"queued",remoteJobId:"x"}}
  });
  await assert.rejects(()=>certifyHerculesVideoRenderer({adapter,request,pollIntervalMs:0}),/renderer_health_check_failed/);
  assert.equal(generated,false);
});

test("rejects artifact evidence bound to another request",async()=>{
  const adapter=healthyAdapter({
    async status(){return {
      status:"completed",
      artifact:{
        uri:"https://renderer.example/out.mp4",mimeType:"video/mp4",sizeBytes:2048,sha256:"b".repeat(64),
        providerEvidence:{requestFingerprint:"c".repeat(64)}
      }
    }}
  });
  await assert.rejects(()=>certifyHerculesVideoRenderer({adapter,request,pollIntervalMs:0}),/renderer_request_fingerprint_mismatch/);
});

test("rejects completed render without cryptographic artifact evidence",async()=>{
  const adapter=healthyAdapter({
    async status(){return {
      status:"completed",
      artifact:{
        uri:"https://renderer.example/out.mp4",mimeType:"video/mp4",sizeBytes:2048,sha256:null,
        providerEvidence:{requestFingerprint:request.requestFingerprint}
      }
    }}
  });
  await assert.rejects(()=>certifyHerculesVideoRenderer({adapter,request,pollIntervalMs:0}),/renderer_artifact_sha256_invalid/);
});

test("fails closed when renderer never reaches a terminal state",async()=>{
  const adapter=healthyAdapter({async status(){return {status:"running"}}});
  await assert.rejects(()=>certifyHerculesVideoRenderer({adapter,request,maxPolls:2,pollIntervalMs:0}),/renderer_certification_timeout/);
});

test("rejects non-video artifact inspection",async()=>{
  const adapter=healthyAdapter({async inspect(){return {ok:true,status:200,contentType:"text/html",contentLength:2048}}});
  await assert.rejects(()=>certifyHerculesVideoRenderer({adapter,request,maxPolls:3,pollIntervalMs:0}),/renderer_artifact_not_video/);
});
