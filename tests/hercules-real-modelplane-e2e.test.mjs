import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateIsolatedChatResult} from "../scripts/hercules-real-modelplane-e2e.mjs";

test("real model-plane result must be generated, local and never release-approved",()=>{
  assert.deepEqual(validateIsolatedChatResult({
    status:200,body:{
      origin:"local-loopback",outputText:"Two plus two is four.",
      inferenceVerified:true,publicReleaseApproved:false
    }
  }),{valid:true,publicReleaseApproved:false});
});

test("empty and simulated/unapproved statuses cannot masquerade as real chat",()=>{
  for(const response of [
    {status:503,body:{error:"local_chat_disabled"}},
    {status:200,body:{origin:"local-loopback",outputText:"",inferenceVerified:true,publicReleaseApproved:false}},
    {status:200,body:{origin:"remote",outputText:"4",inferenceVerified:true,publicReleaseApproved:false}},
    {status:200,body:{origin:"local-loopback",outputText:"4",inferenceVerified:false,publicReleaseApproved:false}},
    {status:200,body:{origin:"local-loopback",outputText:"4",inferenceVerified:true,publicReleaseApproved:true}}
  ])assert.equal(validateIsolatedChatResult(response).valid,false);
});

test("end-to-end lab script and workflow retain only localhost routing",()=>{
  const source=readFileSync(new URL("../scripts/hercules-real-modelplane-e2e.mjs",import.meta.url),"utf8");
  const workflow=readFileSync(new URL("../.github/workflows/hercules-smollm2-360m-trial.yml",import.meta.url),"utf8");
  for(const exact of [
    'createLocalChatAdapter','createModelPlaneService',
    'protocol:"llama-cpp"','endpoint:"http://127.0.0.1:18773"',
    'http://127.0.0.1:','publicReleaseApproved'
  ])assert.ok(source.includes(exact),"missing "+exact);
  assert.match(workflow,/node scripts\/hercules-real-modelplane-e2e\.mjs/);
  assert.match(workflow,/node --test tests\/hercules-real-modelplane-e2e\.test\.mjs/);
  assert.doesNotMatch(source,/railway\.app|render\.com\/api|supabase\.co\/functions|api\.openai\.com/);
});
