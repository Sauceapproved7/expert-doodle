// Original Hercules owner/off-host Ed25519 permit envelope.
// Owner PRIVATE key never belongs on a Hercules Host Engine machine.
// This module does not contact providers, provision servers, or grant production.
import {createPrivateKey,createPublicKey,randomBytes,sign,verify} from "node:crypto";
import {assertSandboxHostPlan} from "./host-agent.mjs";

export const OWNER_PERMIT_SCHEMA="hercules.cloud.sandbox-permit.ed25519.v1";
const MAX_DURATION_MS=5*60*1000;
const CLOCK_SKEW_MS=30*1000;
function fail(reason){throw new Error(reason)}
function canonical(permit){
 return JSON.stringify({
  schema:permit.schema,action:permit.action,planDigest:permit.planDigest,
  issuedAt:permit.issuedAt,expiresAt:permit.expiresAt,nonce:permit.nonce
 });
}
function validateShape(plan,permit,action,now){
 assertSandboxHostPlan(plan);
 if(!permit||typeof permit!=="object"||Array.isArray(permit)||
    permit.schema!==OWNER_PERMIT_SCHEMA)fail("permit_schema_invalid");
 if(!["start","rollback"].includes(action)||permit.action!==action)
  fail("permit_action_mismatch");
 if(permit.planDigest!==plan.planDigest||
    !Number.isSafeInteger(permit.issuedAt)||!Number.isSafeInteger(permit.expiresAt)||
    permit.expiresAt<=permit.issuedAt||
    permit.expiresAt-permit.issuedAt>MAX_DURATION_MS||
    typeof permit.nonce!=="string"||!/^[a-f0-9]{32}$/.test(permit.nonce))
   fail("permit_invalid");
 if(!Number.isSafeInteger(now)||now<permit.issuedAt-CLOCK_SKEW_MS)
   fail("permit_not_yet_valid");
 if(now>permit.expiresAt)fail("permit_expired");
}
function parseOwnerPrivateKey(value){
 if(typeof value!=="string"||value.length>6000||!value.includes("PRIVATE KEY"))
  fail("owner_private_key_invalid");
 try{
  const k=createPrivateKey(value);
  if(k.asymmetricKeyType!=="ed25519")fail("owner_private_key_invalid");
  return k;
 }catch{fail("owner_private_key_invalid")}
}
function parseOwnerPublicKey(value){
 if(typeof value!=="string"||value.length>6000||
    !value.includes("-----BEGIN PUBLIC KEY-----")||
    value.includes("PRIVATE KEY"))fail("owner_public_key_required");
 try{
  const k=createPublicKey(value);
  if(k.asymmetricKeyType!=="ed25519")fail("owner_public_key_required");
  return k;
 }catch{fail("owner_public_key_required")}
}
export function createOwnerSignedPermit(plan,{
 ownerPrivateKey,action="start",now=Date.now(),ttlMs=120000
}={}){
 assertSandboxHostPlan(plan);
 const privateKey=parseOwnerPrivateKey(ownerPrivateKey);
 if(!["start","rollback"].includes(action))fail("permit_action_invalid");
 if(!Number.isSafeInteger(now)||!Number.isSafeInteger(ttlMs)||
    ttlMs<1000||ttlMs>MAX_DURATION_MS)fail("permit_ttl_invalid");
 const data={
  schema:OWNER_PERMIT_SCHEMA,action,planDigest:plan.planDigest,
  issuedAt:now,expiresAt:now+ttlMs,nonce:randomBytes(16).toString("hex")
 };
 return Object.freeze({...data,
  signature:sign(null,Buffer.from(canonical(data),"utf8"),privateKey).toString("base64url")
 });
}
export function verifyOwnerSignedPermit(plan,permit,{
 ownerPublicKey,action,now=Date.now()
}={}){
 const key=parseOwnerPublicKey(ownerPublicKey);
 validateShape(plan,permit,action,now);
 const signature=permit.signature;
 if(typeof signature!=="string"||!/^[A-Za-z0-9_-]{86}$/.test(signature))
  fail("permit_signature_invalid");
 let decoded;
 try{decoded=Buffer.from(signature,"base64url")}catch{fail("permit_signature_invalid")}
 if(decoded.length!==64||
    !verify(null,Buffer.from(canonical(permit),"utf8"),key,decoded))
  fail("permit_signature_invalid");
 return true;
}
