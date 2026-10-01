import test from "node:test";
import assert from "node:assert/strict";
import {createDeployGuardianBinding} from "../hercules-guardian/deploy-catalog-binding.mjs";

const deployment={deploymentId:"deploy-verified-1",request:{artifact:{sha256:"a".repeat(64)},config:{sha256:"b".repeat(64)},target:{identity:"hercules-deploy:production"},policy:{id:"guardian-deploy-v1"}},state:{status:"verified",verificationEvidence:{verified:true}}};

test("verified Hercules Deploy evidence binds into Guardian dimensions",async()=>{
 const binding=createDeployGuardianBinding({deployment});
 assert.equal(binding.id,"deploy"); assert.equal(binding.scope,"control-plane"); assert.equal(binding.executionAuthority,false);
 assert.deepEqual(await binding.observe(),binding.baseline);
 assert.equal(binding.baseline.identity,"hercules-deploy:production");
});
test("Deploy binding fails closed on unverified evidence",()=>assert.throws(()=>createDeployGuardianBinding({deployment:{...deployment,state:{status:"verifying",verificationEvidence:null}}}),/verified deployment evidence is required/));
