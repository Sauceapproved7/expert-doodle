import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {mkdtemp,writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {EventEmitter} from "node:events";
import {PassThrough} from "node:stream";
import {
  createAssemblyPlan,
  validateAssemblyPlan,
  buildCaptionTimelineFromStoryboard,
  createAssemblyEvidence,
} from "../hercules-video/assembly-core.mjs";
import {compileFfmpegAssembly,runFfmpegAssembly} from "../hercules-video/ffmpeg-assembly-runner.mjs";

const sha=label=>createHash("sha256").update(label).digest("hex");

function basePlan() {
  return createAssemblyPlan({
    projectId:"launch",
    clips:[
      {shotId:"a",uri:"file:///tmp/a.mp4",durationSeconds:4,sha256:sha("a")},
      {shotId:"b",uri:"file:///tmp/b.mp4",durationSeconds:5,sha256:sha("b")},
    ],
    audioTracks:[
      {id:"music",kind:"soundtrack",uri:"file:///tmp/music.wav",startSeconds:0,durationSeconds:9,gainDb:-8,sha256:sha("music")},
      {id:"voice",kind:"narration",uri:"file:///tmp/voice.wav",startSeconds:1,durationSeconds:4,gainDb:0,sha256:sha("voice")},
    ],
    captions:[{text:"BUILD",startSeconds:0,endSeconds:4}],
  });
}

test("assembly plan is deterministic and validates evidence inputs",()=>{
  const a=basePlan();
  const b=basePlan();
  assert.equal(a.fingerprint,b.fingerprint);
  assert.equal(a.totalDurationSeconds,9);
  assert.equal(validateAssemblyPlan(a),a);
});

test("assembly plan rejects remote media and out-of-range audio",()=>{
  assert.throws(()=>createAssemblyPlan({
    projectId:"x",
    clips:[{shotId:"a",uri:"https://example.com/a.mp4",durationSeconds:1,sha256:sha("a")}],
  }),/assembly_clip_local_uri_required/);

  assert.throws(()=>createAssemblyPlan({
    projectId:"x",
    clips:[{shotId:"a",uri:"file:///tmp/a.mp4",durationSeconds:2,sha256:sha("a")}],
    audioTracks:[{kind:"sfx",uri:"file:///tmp/x.wav",startSeconds:1,durationSeconds:2,sha256:sha("x")}],
  }),/assembly_audio_out_of_range/);
});

test("caption timeline follows storyboard order",()=>{
  assert.deepEqual(buildCaptionTimelineFromStoryboard({shots:[
    {durationSeconds:4,text:"BUILD"},
    {durationSeconds:3,text:null},
    {durationSeconds:5,text:"PROVE"},
  ]}),[
    {text:"BUILD",startSeconds:0,endSeconds:4},
    {text:"PROVE",startSeconds:7,endSeconds:12},
  ]);
});

test("FFmpeg compiler creates concat captions ducking and loudness without a shell",()=>{
  const compiled=compileFfmpegAssembly(basePlan(),{outputPath:"/tmp/final.mp4"});
  assert.equal(compiled.command,"ffmpeg");
  assert.ok(compiled.args.includes("-filter_complex"));
  const graph=compiled.args[compiled.args.indexOf("-filter_complex")+1];
  assert.match(graph,/concat=n=2/);
  assert.match(graph,/drawtext=/);
  assert.match(graph,/sidechaincompress=/);
  assert.match(graph,/loudnorm=/);
  assert.equal(compiled.args.at(-1),"/tmp/final.mp4");
});

test("assembly runner records final checksum and plan provenance",async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),"hercules-assembly-"));
  const clipA=path.join(dir,"a.mp4");
  const clipB=path.join(dir,"b.mp4");
  const music=path.join(dir,"music.wav");
  const voice=path.join(dir,"voice.wav");
  const output=path.join(dir,"final.mp4");
  await Promise.all([
    writeFile(clipA,"a"),
    writeFile(clipB,"b"),
    writeFile(music,"music"),
    writeFile(voice,"voice"),
  ]);
  const plan=createAssemblyPlan({
    projectId:"launch",
    clips:[
      {shotId:"a",uri:pathToFileURL(clipA).href,durationSeconds:4,sha256:sha("a")},
      {shotId:"b",uri:pathToFileURL(clipB).href,durationSeconds:5,sha256:sha("b")},
    ],
    audioTracks:[
      {id:"music",kind:"soundtrack",uri:pathToFileURL(music).href,startSeconds:0,durationSeconds:9,gainDb:-8,sha256:sha("music")},
      {id:"voice",kind:"narration",uri:pathToFileURL(voice).href,startSeconds:1,durationSeconds:4,gainDb:0,sha256:sha("voice")},
    ],
    captions:[{text:"BUILD",startSeconds:0,endSeconds:4}],
  });

  const spawnImpl=(command,args)=>{
    const child=new EventEmitter();
    child.stdout=new PassThrough();
    child.stderr=new PassThrough();
    child.kill=()=>{};
    queueMicrotask(async()=>{
      await writeFile(args.at(-1),"final-video");
      child.emit("close",0);
    });
    return child;
  };

  const result=await runFfmpegAssembly(plan,{outputPath:output,spawnImpl,timeoutMs:1000});
  assert.match(result.output.sha256,/^[a-f0-9]{64}$/);
  assert.equal(result.evidence.planFingerprint,plan.fingerprint);
  assert.equal(result.evidence.output.sha256,result.output.sha256);
  assert.match(result.evidence.fingerprint,/^[a-f0-9]{64}$/);
});

test("assembly evidence rejects tampered plan fingerprint",()=>{
  const plan=basePlan();
  const tampered={...plan,totalDurationSeconds:99};
  assert.throws(()=>createAssemblyEvidence({
    plan:tampered,
    output:{uri:"file:///tmp/final.mp4",sizeBytes:1,sha256:sha("final")},
  }),/assembly_plan_fingerprint_mismatch/);
});
