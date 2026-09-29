import {generateKeyPairSync, randomUUID, sign, verify} from "node:crypto";
import {mkdir, readFile, rename, writeFile} from "node:fs/promises";
import {dirname, join, resolve} from "node:path";

const PLATFORM_MAP=new Map([["win32","windows"],["darwin","macos"],["linux","linux"]]);

function semver(value){
  if(!/^\d+\.\d+\.\d+$/.test(String(value||"")))throw new Error("valid Cleaner semantic version required");
  return String(value);
}

function platformName(value){
  const mapped=PLATFORM_MAP.get(String(value));
  if(mapped)return mapped;
  if(["windows","macos","linux"].includes(String(value)))return String(value);
  throw new Error("supported platform required");
}

function activationCode(value){
  const code=String(value||"").trim().toUpperCase();
  if(!/^HC-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code))throw new Error("valid Hercules Cleaner activation code required");
  return code;
}

export function createDeviceIdentity({platform,version}={}){
  const pair=generateKeyPairSync("ed25519");
  return Object.freeze({
    schema:"sauceapproved.hercules-cleaner.device-identity",
    deviceId:randomUUID(),
    platform:platformName(platform),
    version:semver(version),
    publicKeyPem:pair.publicKey.export({type:"spki",format:"pem"}).toString(),
    privateKeyPem:pair.privateKey.export({type:"pkcs8",format:"pem"}).toString(),
  });
}

export function buildActivationRequest({identity,activationCode:code}={}){
  if(identity?.schema!=="sauceapproved.hercules-cleaner.device-identity")throw new Error("valid Cleaner device identity required");
  const platform=platformName(identity.platform);
  const version=semver(identity.version);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(identity.deviceId||"")))throw new Error("valid opaque device id required");
  if(!/^-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----\n?$/.test(String(identity.publicKeyPem||"")))throw new Error("valid Ed25519 public key required");
  return {
    productCode:"hercules-cleaner",
    deviceId:String(identity.deviceId),
    platform,
    version,
    publicKeyPem:String(identity.publicKeyPem),
    activationCode:activationCode(code),
  };
}

export function signDeviceChallenge({privateKeyPem,challenge}={}){
  const value=String(challenge||"");
  if(!value||value.length>512)throw new Error("bounded device challenge required");
  return sign(null,Buffer.from(value,"utf8"),String(privateKeyPem)).toString("base64");
}

export function verifyDeviceChallenge({publicKeyPem,challenge,signature}={}){
  try{
    const value=String(challenge||"");
    if(!value||value.length>512)return false;
    return verify(null,Buffer.from(value,"utf8"),String(publicKeyPem),Buffer.from(String(signature||""),"base64"));
  }catch{return false}
}

function statePath(stateRoot){
  return join(resolve(stateRoot),"device.json");
}

async function atomicJson(path,value){
  await mkdir(dirname(path),{recursive:true,mode:0o700});
  const temp=path+"."+randomUUID()+".tmp";
  await writeFile(temp,JSON.stringify(value,null,2)+"\n",{mode:0o600});
  await rename(temp,path);
}

export async function saveDeviceCredential({stateRoot,identity,credential}={}){
  if(!stateRoot)throw new Error("state root required");
  if(identity?.schema!=="sauceapproved.hercules-cleaner.device-identity")throw new Error("valid Cleaner device identity required");
  if(!credential?.deviceCredential||String(credential.deviceCredential).length<16)throw new Error("device credential required");
  const record={
    schema:"sauceapproved.hercules-cleaner.device-credential",
    identity,
    credential:{
      deviceCredential:String(credential.deviceCredential),
      activatedAt:String(credential.activatedAt||new Date().toISOString()),
    },
  };
  await atomicJson(statePath(stateRoot),record);
  return record;
}

export async function loadDeviceCredential({stateRoot}={}){
  const parsed=JSON.parse(await readFile(statePath(stateRoot),"utf8"));
  if(parsed?.schema!=="sauceapproved.hercules-cleaner.device-credential")throw new Error("invalid Cleaner device credential state");
  return parsed;
}


async function postJson(fetchImpl,endpoint,body){
  const response=await fetchImpl(endpoint,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(body),
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data?.ok!==true){
    throw new Error(String(data?.error||"Cleaner device activation request failed"));
  }
  return data;
}

export async function activateCleanerDevice({
  endpoint,
  identity,
  activationCode,
  fetchImpl=globalThis.fetch,
}={}){
  const url=new URL(String(endpoint||""));
  if(url.protocol!=="https:")throw new Error("Cleaner device activation endpoint must use HTTPS");
  if(typeof fetchImpl!=="function")throw new Error("fetch implementation required");
  const base=buildActivationRequest({identity,activationCode});
  const challenge=await postJson(fetchImpl,url.toString(),{
    action:"registration_challenge",
    ...base,
  });
  if(!challenge?.challengeId||!challenge?.challenge)throw new Error("Cleaner activation challenge response invalid");
  const signature=signDeviceChallenge({privateKeyPem:identity.privateKeyPem,challenge:String(challenge.challenge)});
  const activated=await postJson(fetchImpl,url.toString(),{
    action:"activate_device",
    ...base,
    challengeId:String(challenge.challengeId),
    challenge:String(challenge.challenge),
    signature,
  });
  if(!activated?.deviceCredential)throw new Error("Cleaner device credential missing from activation response");
  return activated;
}
