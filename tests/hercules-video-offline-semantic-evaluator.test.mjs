import assert from "node:assert/strict";
import test from "node:test";
import {EventEmitter} from "node:events";
import {PassThrough} from "node:stream";
import {createOfflineSemanticEvaluator} from "../hercules-video/evaluators/offline-semantic-evaluator.mjs";

function fakeSpawn(response,inspect) {
  return (command,args,options)=>{
    inspect({command,args,options});
    const child=new EventEmitter();
    child.stdin=new PassThrough(); child.stdout=new PassThrough(); child.stderr=new PassThrough();
    child.kill=()=>{};
    let body="";
    child.stdin.on("data",c=>body+=c);
    child.stdin.on("end",()=>{
      const request=JSON.parse(body);
      child.stdout.end(JSON.stringify(typeof response==="function"?response(request):response));
      queueMicrotask(()=>child.emit("close",0));
    });
    return child;
  };
}

test("offline evaluator enforces local execution and returns bounded evidence",async()=>{
  let invocation;
  const evaluator=createOfflineSemanticEvaluator({
    evaluatorId:"hercules-local-vision",
    command:"python",
    args:["/opt/hercules/evaluator.py"],
    spawnImpl:fakeSpawn(req=>({ok:true,scores:{promptAdherence:.9,temporalConsistency:.8,visualQuality:.9,brandConsistency:.95,artifactFreedom:.9,reliability:.85},notes:["bounded"]}),v=>invocation=v),
    readiness:async()=>({modelId:"local-vision-evaluator",revision:"r1",manifestFingerprint:"a".repeat(64)}),
    statImpl:async()=>({isFile:()=>true,size:10}),
  });
  const result=await evaluator({shot:{id:"hero",prompt:"premium UI"},artifact:{uri:"file:///tmp/hero.mp4",sha256:"b".repeat(64)}});
  assert.equal(invocation.options.shell,false);
  assert.equal(invocation.options.env.HF_HUB_OFFLINE,"1");
  assert.equal(invocation.options.env.TRANSFORMERS_OFFLINE,"1");
  assert.equal(result.brandConsistency,.95);
  assert.equal(result.evidence.modelId,"local-vision-evaluator");
  assert.match(result.evidence.fingerprint,/^[a-f0-9]{64}$/);
});

test("offline evaluator rejects non-local media and out-of-range scores",async()=>{
  const base={evaluatorId:"local",command:"python",args:["/worker.py"],readiness:async()=>({modelId:"m",revision:"r",manifestFingerprint:"a".repeat(64)}),statImpl:async()=>({isFile:()=>true,size:1})};
  const evaluator=createOfflineSemanticEvaluator({...base,spawnImpl:fakeSpawn({ok:true,scores:{promptAdherence:2,temporalConsistency:.8,visualQuality:.8,brandConsistency:.8,artifactFreedom:.8,reliability:.8}},()=>{})});
  await assert.rejects(()=>evaluator({shot:{id:"x"},artifact:{uri:"https://example.com/x.mp4"}}),/offline_evaluator_local_media_required/);
  await assert.rejects(()=>evaluator({shot:{id:"x"},artifact:{uri:"file:///tmp/x.mp4"}}),/offline_evaluator_score_invalid:promptAdherence/);
});