import test from "node:test";
import assert from "node:assert/strict";
import {createHerculesBotApp} from "../hercules-bot/app-server.mjs";

function makeApp(initial={emergencyStopActive:true,identityTrusted:true,auditTrusted:true}){
  let state={...initial};
  const boundary={
    async authenticateOwner(value){if(value!=="Bearer valid-owner")throw Object.assign(new Error("owner identity rejected"),{statusCode:401});return {id:"owner-1",authorization:value}},
    async readControlState(){return {emergencyStopClear:state.emergencyStopActive===false,identityTrusted:state.identityTrusted===true,auditTrusted:state.auditTrusted===true}},
    async setExternalStop(_principal,action){state.emergencyStopActive=action==="stop";return {emergencyStopClear:!state.emergencyStopActive,identityTrusted:state.identityTrusted,auditTrusted:state.auditTrusted}},
    verifyRecoveryArtifact(value){return value?.valid===true}
  };
  return createHerculesBotApp({boundary});
}

test("operator APIs require verified owner identity",async()=>{
  const app=makeApp({emergencyStopActive:false,identityTrusted:true,auditTrusted:true});
  const result=await app.handle({method:"POST",url:"/api/command",body:{text:"move body to stand"}});
  assert.equal(result.status,401);
});

test("external emergency stop blocks approval and mutations while keeping diagnostics available",async()=>{
  const app=makeApp();
  const owner={authorization:"Bearer valid-owner"};
  const blocked=await app.handle({...owner,method:"POST",url:"/api/command",body:{text:"move body to stand"}});
  assert.equal(blocked.status,403);
  const diagnostic=await app.handle({...owner,method:"POST",url:"/api/command",body:{text:"inspect vault"}});
  assert.equal(diagnostic.status,200);
  assert.equal(diagnostic.body.mode,"planned");
});

test("resume is denied when audit trust is false",async()=>{
  const app=makeApp({emergencyStopActive:true,identityTrusted:true,auditTrusted:false});
  const result=await app.handle({authorization:"Bearer valid-owner",method:"POST",url:"/api/resume",body:{}});
  assert.equal(result.status,403);
});
