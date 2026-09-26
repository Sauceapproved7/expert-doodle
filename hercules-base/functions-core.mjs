import {createHash} from "node:crypto";

const NAME=/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const ENTRY=/^[A-Za-z0-9](?:[A-Za-z0-9._/-]{0,253}[A-Za-z0-9])?$/;
const RUNTIMES=new Set(["node22"]);
const NETWORK=new Set(["none","egress-allowlist"]);

function boundedInt(value,label,{min,max,defaultValue}){
  const candidate=value===undefined?defaultValue:Number(value);
  if(!Number.isInteger(candidate)||candidate<min||candidate>max){
    throw new TypeError(label+" is invalid");
  }
  return candidate;
}

export function normalizeFunctionManifest(input={}){
  if(!input||typeof input!=="object"||Array.isArray(input)){
    throw new TypeError("function manifest must be an object");
  }

  const name=String(input.name??"").trim().toLowerCase();
  if(!NAME.test(name))throw new TypeError("function name is invalid");

  const runtime=String(input.runtime??"node22");
  if(!RUNTIMES.has(runtime))throw new TypeError("function runtime is unsupported");

  const entrypoint=String(input.entrypoint??"").trim();
  if(
    !ENTRY.test(entrypoint)||
    entrypoint.startsWith("/")||
    entrypoint.includes("..")||
    entrypoint.includes("\\")||
    !entrypoint.endsWith(".mjs")
  ){
    throw new TypeError("function entrypoint is invalid");
  }

  const timeoutMs=boundedInt(input.timeoutMs,"function timeout",{min:100,max:30000,defaultValue:5000});
  const memoryMb=boundedInt(input.memoryMb,"function memory",{min:32,max:1024,defaultValue:128});
  const network=String(input.network??"none");
  if(!NETWORK.has(network))throw new TypeError("function network policy is unsupported");

  const sourceSha256=String(input.sourceSha256??"").toLowerCase();
  if(!/^[a-f0-9]{64}$/.test(sourceSha256)){
    throw new TypeError("function source SHA-256 is invalid");
  }

  return Object.freeze({
    version:1,
    name,
    runtime,
    entrypoint,
    timeoutMs,
    memoryMb,
    network,
    sourceSha256,
  });
}

export function functionFingerprint(input){
  const manifest=normalizeFunctionManifest(input);
  return createHash("sha256")
    .update(JSON.stringify(manifest))
    .digest("hex");
}
