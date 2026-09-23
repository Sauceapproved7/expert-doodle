import assert from "node:assert/strict";
import test from "node:test";
import {mkdtemp, mkdir, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {EventEmitter} from "node:events";
import {createHash} from "node:crypto";
import {PassThrough} from "node:stream";
import {probeCudaHost, assertWan22Hardware} from "../hercules-video/hardware-probe.mjs";
import {Wan22Ti2v5bRunner} from "../hercules-video/runners/wan22-ti2v-5b.mjs";
import {createRenderRequest} from "../hercules-video/render-bridge.mjs";

test("hardware probe accepts a 24GB-class NVIDIA GPU", async () => {
  const fakeExec = async (cmd) => {
    if (cmd === "nvidia-smi") return {stdout:"NVIDIA RTX 4090, 24564, 555.99\n"};
    if (cmd === "nvcc") return {stdout:"Cuda compilation tools, release 12.4, V12.4.99\n"};
    throw new Error("unexpected");
  };
  const probe = await probeCudaHost({exec:fakeExec,minVramGb:24});
  assert.equal(probe.eligible,true);
  assert.equal(probe.cudaToolkitVersion,"12.4");
  assert.equal(assertWan22Hardware(probe).selectedGpu.name,"NVIDIA RTX 4090");
});

test("hardware gate rejects insufficient VRAM", () => {
  assert.throws(() => assertWan22Hardware({
    cudaAvailable:true,
    gpus:[{name:"small",memoryGiB:16}],
  }), /wan22_minimum_vram_not_met/);
});

test("Wan runner builds the official TI2V-5B CLI shape without shell interpolation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(),"hercules-wan-"));
  const repo = path.join(root,"Wan2.2");
  const ckpt = path.join(root,"ckpt");
  const out = path.join(root,"out");
  await Promise.all([mkdir(repo),mkdir(ckpt),mkdir(out)]);
  await writeFile(path.join(repo,"generate.py"),"# fake");
  const calls=[];
  const spawnImpl=(cmd,args,opts)=>{
    calls.push({cmd,args,opts});
    const child=new EventEmitter();
    child.stdout=new PassThrough();
    child.stderr=new PassThrough();
    child.kill=()=>{};
    queueMicrotask(async()=>{
      const saveIndex=args.indexOf("--save_file");
      await writeFile(args[saveIndex+1],Buffer.from("video"));
      child.emit("close",0);
    });
    return child;
  };
  const runner=new Wan22Ti2v5bRunner({
    wanRepoDir:repo,
    checkpointDir:ckpt,
    outputDir:out,
    upstreamCommit:"3a5cbcdd208e0acbe5c2c90478551660407ea26c",
    hardwareProbe:{cudaAvailable:true,cudaToolkitVersion:"12.4",gpus:[{name:"RTX 4090",memoryGiB:24,driverVersion:"555"}]},
    checkpointSha256:testSha("wan-checkpoint-a"),
    spawnImpl,
  });
  const request=createRenderRequest({
    projectId:"launch",
    shot:{id:"hero",prompt:"test prompt",durationSeconds:4,aspectRatio:"9:16",requiresAudio:false},
    seed:42,
  });
  const result=await runner.render(request);
  assert.equal(calls.length,1);
  assert.equal(calls[0].cmd,"python");
  assert.deepEqual(calls[0].args.slice(0,8),[
    "generate.py","--task","ti2v-5B","--size","704*1280","--frame_num","97","--ckpt_dir"
  ]);
  assert.ok(calls[0].args.includes("--offload_model"));
  assert.ok(calls[0].args.includes("--convert_model_dtype"));
  assert.ok(calls[0].args.includes("--t5_cpu"));
  assert.ok(calls[0].args.includes("--base_seed"));
  assert.equal(result.artifact.metadata.upstreamCommit,"3a5cbcdd208e0acbe5c2c90478551660407ea26c");
  assert.match(result.artifact.sha256,/^[a-f0-9]{64}$/);
});

test("Wan runner refuses native-audio jobs rather than pretending support", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(),"hercules-wan-audio-"));
  const repo = path.join(root,"Wan2.2");
  const ckpt = path.join(root,"ckpt");
  const out = path.join(root,"out");
  await Promise.all([mkdir(repo),mkdir(ckpt),mkdir(out)]);
  await writeFile(path.join(repo,"generate.py"),"# fake");
  const runner=new Wan22Ti2v5bRunner({
    wanRepoDir:repo,
    checkpointDir:ckpt,
    outputDir:out,
    upstreamCommit:"3a5cbcdd208e0acbe5c2c90478551660407ea26c",
    hardwareProbe:{cudaAvailable:true,gpus:[{name:"RTX 4090",memoryGiB:24}]},
    checkpointSha256:testSha("wan-checkpoint-b"),
  });
  const request=createRenderRequest({
    projectId:"launch",
    shot:{id:"hero",prompt:"test",durationSeconds:4,aspectRatio:"9:16",requiresAudio:true},
  });
  await assert.rejects(() => runner.render(request), /wan22_native_audio_not_supported/);
});


test("Wan runner rejects relative installation paths and missing checkpoint evidence", async () => {
  assert.throws(() => new Wan22Ti2v5bRunner({
    wanRepoDir:"./Wan2.2",
    checkpointDir:"/tmp/ckpt",
    outputDir:"/tmp/out",
    upstreamCommit:"3a5cbcdd208e0acbe5c2c90478551660407ea26c",
    checkpointSha256:testSha("wan-checkpoint-c"),
    hardwareProbe:{cudaAvailable:true,gpus:[{name:"RTX 4090",memoryGiB:24}]},
  }), /wan22_repo_dir_required/);

  assert.throws(() => new Wan22Ti2v5bRunner({
    wanRepoDir:"/tmp/Wan2.2",
    checkpointDir:"/tmp/ckpt",
    outputDir:"/tmp/out",
    upstreamCommit:"3a5cbcdd208e0acbe5c2c90478551660407ea26c",
    hardwareProbe:{cudaAvailable:true,gpus:[{name:"RTX 4090",memoryGiB:24}]},
  }), /wan22_checkpoint_sha256_required/);
});
