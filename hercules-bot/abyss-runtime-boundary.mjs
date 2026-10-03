import {createPublicKey, verify as verifySignature} from "node:crypto";

const BEARER=/^Bearer\s+\S+$/i;
const SHA256=/^[a-f0-9]{64}$/i;
const B64URL=/^[A-Za-z0-9_-]+$/;

function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
}
function json(value){return JSON.stringify(stable(value));}
function bearer(value){
  const v=String(value??"").trim();
  if(!BEARER.test(v))throw Object.assign(new Error("owner authorization required"),{statusCode:401});
  return v;
}
function baseUrl(value,label){
  let u;
  try{u=new URL(String(value??""))}catch{throw new Error(label+" not configured")}
  if(u.protocol!=="https:"&&!(u.protocol==="http:"&&(u.hostname==="127.0.0.1"||u.hostname==="localhost")))throw new Error(label+" must use HTTPS");
  return u;
}

export function createAbyssRuntimeBoundary({
  supabaseUrl=process.env.SUPABASE_PUBLIC_URL,
  publishableKey=process.env.SUPABASE_PUBLISHABLE_KEY,
  ownerUserId=process.env.HERCULES_OWNER_USER_ID,
  controlUrl=process.env.HERCULES_ABYSS_CONTROL_URL,
  recoveryPublicKey=process.env.HERCULES_ABYSS_RECOVERY_PUBLIC_KEY,
  recoveryKeyId=process.env.HERCULES_ABYSS_RECOVERY_KEY_ID,
  fetchImpl=fetch,
  now=()=>Date.now()
}={}){
  const authBase=supabaseUrl?baseUrl(supabaseUrl,"Supabase auth"):null;
  const controlBase=controlUrl?baseUrl(controlUrl,"external Abyss control plane"):null;
  const ownerId=String(ownerUserId??"").trim();

  async function authenticateOwner(authorization){
    const auth=bearer(authorization);
    if(!authBase||!publishableKey||!ownerId)throw Object.assign(new Error("owner authority is not configured"),{statusCode:503});
    let response;
    try{
      response=await fetchImpl(new URL("/auth/v1/user",authBase),{method:"GET",headers:{apikey:publishableKey,authorization:auth},signal:AbortSignal.timeout(10000)});
    }catch{throw Object.assign(new Error("owner identity service unavailable"),{statusCode:503})}
    if(!response.ok)throw Object.assign(new Error("owner identity rejected"),{statusCode:401});
    let user;
    try{user=await response.json()}catch{throw Object.assign(new Error("owner identity response invalid"),{statusCode:503})}
    if(!user||typeof user.id!=="string"||user.id!==ownerId)throw Object.assign(new Error("owner identity rejected"),{statusCode:403});
    return Object.freeze({id:user.id,authorization:auth});
  }

  async function readControlState(principal){
    if(!controlBase||!publishableKey)throw new Error("external emergency-stop authority is not configured");
    let response;
    try{
      response=await fetchImpl(controlBase,{method:"GET",headers:{apikey:publishableKey,authorization:principal?.authorization??""},signal:AbortSignal.timeout(5000)});
    }catch{throw new Error("external emergency-stop authority unavailable")}
    if(!response.ok)throw new Error("external emergency-stop authority rejected request");
    let state;
    try{state=await response.json()}catch{throw new Error("external emergency-stop state invalid")}
    if(state?.emergencyStopActive!==true&&state?.emergencyStopActive!==false)throw new Error("external emergency-stop state invalid");
    if(state?.identityTrusted!==true&&state?.identityTrusted!==false)throw new Error("external identity trust state invalid");
    if(state?.auditTrusted!==true&&state?.auditTrusted!==false)throw new Error("external audit trust state invalid");
    return Object.freeze({
      emergencyStopClear:state.emergencyStopActive===false,
      identityTrusted:state.identityTrusted===true,
      auditTrusted:state.auditTrusted===true
    });
  }

  async function setExternalStop(principal,action){
    if(action!=="stop"&&action!=="resume")throw new Error("unsupported emergency-stop action");
    if(!controlBase||!publishableKey)throw new Error("external emergency-stop authority is not configured");
    let response;
    try{
      response=await fetchImpl(controlBase,{method:"POST",headers:{apikey:publishableKey,authorization:principal?.authorization??"","content-type":"application/json"},body:JSON.stringify({action}),signal:AbortSignal.timeout(5000)});
    }catch{throw new Error("external emergency-stop authority unavailable")}
    if(!response.ok)throw new Error("external emergency-stop update rejected");
    return readControlState(principal);
  }

  function verifyRecoveryArtifact(artifact){
    try{
      if(!recoveryPublicKey||!recoveryKeyId||!artifact||typeof artifact!=="object")return false;
      if(artifact.keyId!==recoveryKeyId||artifact.algorithm!=="Ed25519"||artifact.knownGood!==true)return false;
      if(typeof artifact.digest!=="string"||!SHA256.test(artifact.digest))return false;
      if(typeof artifact.issuedAt!=="string"||typeof artifact.expiresAt!=="string")return false;
      const issued=Date.parse(artifact.issuedAt),expires=Date.parse(artifact.expiresAt),current=now();
      if(!Number.isFinite(issued)||!Number.isFinite(expires)||issued>current||expires<=current||expires<=issued)return false;
      if(expires-issued>24*60*60*1000)return false;
      if(typeof artifact.signature!=="string"||!B64URL.test(artifact.signature))return false;
      const publicKey=createPublicKey(recoveryPublicKey);
      const payload={algorithm:artifact.algorithm,digest:artifact.digest.toLowerCase(),expiresAt:artifact.expiresAt,issuedAt:artifact.issuedAt,keyId:artifact.keyId,knownGood:artifact.knownGood};
      return verifySignature(null,Buffer.from(json(payload)),publicKey,Buffer.from(artifact.signature,"base64url"));
    }catch{return false}
  }

  return Object.freeze({authenticateOwner,readControlState,setExternalStop,verifyRecoveryArtifact});
}
