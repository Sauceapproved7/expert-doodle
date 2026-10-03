import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {createAbyssRuntimeBoundary} from "../hercules-bot/abyss-runtime-boundary.mjs";

const ownerId="owner-123";
function response(status,body){return {ok:status>=200&&status<300,status,json:async()=>body};}
function authFetch({userId=ownerId,authStatus=200,stateStatus=200,state={emergencyStopActive:false,identityTrusted:true,auditTrusted:true}}={}){
  return async(url,options={})=>{
    if(String(url).endsWith("/auth/v1/user")){
      if(options.headers?.authorization!=="Bearer valid.jwt")return response(401,{});
      return response(authStatus,{id:userId});
    }
    if(options.method==="POST")return response(stateStatus,state);
    return response(stateStatus,state);
  };
}

test("owner must be authenticated by Supabase and match the pinned owner id",async()=>{
  const b=createAbyssRuntimeBoundary({supabaseUrl:"https://auth.example",publishableKey:"public",ownerUserId:ownerId,controlUrl:"https://control.example",fetchImpl:authFetch()});
  assert.equal((await b.authenticateOwner("Bearer valid.jwt")).id,ownerId);
  await assert.rejects(()=>b.authenticateOwner("ownerApproved=true"),/owner authorization required/);
  const other=createAbyssRuntimeBoundary({supabaseUrl:"https://auth.example",publishableKey:"public",ownerUserId:ownerId,controlUrl:"https://control.example",fetchImpl:authFetch({userId:"other-user"})});
  await assert.rejects(()=>other.authenticateOwner("Bearer valid.jwt"),/owner identity rejected/);
});

test("missing, malformed, active-stop, or untrusted external state is not green",async()=>{
  const missing=createAbyssRuntimeBoundary({fetchImpl:authFetch()});
  await assert.rejects(()=>missing.readControlState({authorization:"Bearer valid.jwt"}),/not configured/);
  for(const state of [
    {emergencyStopActive:true,identityTrusted:true,auditTrusted:true},
    {emergencyStopActive:false,identityTrusted:false,auditTrusted:true},
    {emergencyStopActive:false,identityTrusted:true,auditTrusted:false}
  ]){
    const b=createAbyssRuntimeBoundary({supabaseUrl:"https://auth.example",publishableKey:"public",ownerUserId:ownerId,controlUrl:"https://control.example",fetchImpl:authFetch({state})});
    const s=await b.readControlState({authorization:"Bearer valid.jwt"});
    assert.equal(s.emergencyStopClear,state.emergencyStopActive===false);
    assert.equal(s.identityTrusted,state.identityTrusted===true);
    assert.equal(s.auditTrusted,state.auditTrusted===true);
  }
  const malformed=createAbyssRuntimeBoundary({supabaseUrl:"https://auth.example",publishableKey:"public",ownerUserId:ownerId,controlUrl:"https://control.example",fetchImpl:authFetch({state:{emergencyStopActive:"false",identityTrusted:true,auditTrusted:true}})});
  await assert.rejects(()=>malformed.readControlState({authorization:"Bearer valid.jwt"}),/state invalid/);
});

test("owner stop and resume are delegated to the independent control plane",async()=>{
  const calls=[];
  const fetchImpl=async(url,options={})=>{calls.push({url:String(url),options});return options.method==="POST"?response(200,{ok:true}):response(200,{emergencyStopActive:false,identityTrusted:true,auditTrusted:true})};
  const b=createAbyssRuntimeBoundary({supabaseUrl:"https://auth.example",publishableKey:"public",ownerUserId:ownerId,controlUrl:"https://control.example/v1/state",fetchImpl});
  const principal={authorization:"Bearer valid.jwt"};
  await b.setExternalStop(principal,"stop");
  await b.setExternalStop(principal,"resume");
  assert.deepEqual(calls.filter(x=>x.options.method==="POST").map(x=>JSON.parse(x.options.body).action),["stop","resume"]);
  await assert.rejects(()=>b.setExternalStop(principal,"maybe"),/unsupported/);
});

test("recovery verifier checks configured Ed25519 key, digest, signer, and validity window",()=>{
  const {privateKey,publicKey}=generateKeyPairSync("ed25519");
  const publicKeyPem=publicKey.export({type:"spki",format:"pem"});
  const now=Date.parse("2026-10-03T12:00:00.000Z");
  const artifact={algorithm:"Ed25519",digest:"a".repeat(64),expiresAt:"2026-10-03T13:00:00.000Z",issuedAt:"2026-10-03T12:00:00.000Z",keyId:"recovery-key-1",knownGood:true};
  const canonical=JSON.stringify(artifact);
  artifact.signature=sign(null,Buffer.from(canonical),privateKey).toString("base64url");
  const b=createAbyssRuntimeBoundary({recoveryPublicKey:publicKeyPem,recoveryKeyId:"recovery-key-1",now:()=>now});
  assert.equal(b.verifyRecoveryArtifact(artifact),true);
  assert.equal(b.verifyRecoveryArtifact({...artifact,digest:"b".repeat(64)}),false);
  assert.equal(b.verifyRecoveryArtifact({...artifact,digest:"A".repeat(64)}),false);
  assert.equal(b.verifyRecoveryArtifact({...artifact,keyId:"wrong"}),false);
  assert.equal(b.verifyRecoveryArtifact({...artifact,expiresAt:"2026-10-03T14:01:00.000Z"}),false);
  assert.equal(createAbyssRuntimeBoundary().verifyRecoveryArtifact(artifact),false);
});
