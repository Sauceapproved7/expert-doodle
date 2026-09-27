import {fileURLToPath} from "node:url";

import {listenHerculesBankBrowserService} from "./browser-service.mjs";

function required(value,label){
  if(typeof value!=="string"||value.trim()==="")throw new TypeError(label+" is required");
  return value.trim();
}

function isLoopbackHost(host){
  return new Set(["127.0.0.1","localhost","::1","[::1]"]).has(host);
}

function endpointFor(address){
  if(!address||typeof address==="string")throw new Error("financial service address unavailable");
  const host=address.address.includes(":")?"["+address.address+"]":address.address;
  return "http://"+host+":"+address.port;
}

export async function startHerculesFinancialService({
  statePath,
  complianceStatePath,
  baseAuthUrl,
  jwtSecret,
  currency="USD",
  issuer="hercules-base",
  audience="hercules-base-api",
  host="127.0.0.1",
  port=38930,
  secureSessionCookies=false,
  fetchImpl=fetch,
  authTimeoutMs=5000,
  nowSeconds=()=>Math.floor(Date.now()/1000),
  randomBytes,
  adminRoles,
}={}){
  required(statePath,"statePath");
  required(baseAuthUrl,"baseAuthUrl");
  required(host,"host");
  if(typeof jwtSecret!=="string"||Buffer.byteLength(jwtSecret)<32){
    throw new TypeError("JWT secret must be at least 32 bytes");
  }
  if(!Number.isInteger(port)||port<0||port>65535)throw new TypeError("port is invalid");
  if(!isLoopbackHost(host)&&secureSessionCookies!==true){
    throw new Error("public binding requires secure browser cookies");
  }

  const service=await listenHerculesBankBrowserService({
    statePath,
    complianceStatePath,
    currency,
    host,
    port,
    baseAuthUrl,
    jwtSecret,
    issuer,
    audience,
    secureSessionCookies,
    fetchImpl,
    authTimeoutMs,
    nowSeconds,
    ...(randomBytes?{randomBytes}:{}),
    ...(adminRoles?{adminRoles}:{}),
  });

  return Object.freeze({
    ...service,
    endpoint:endpointFor(service.server.address()),
  });
}

async function main(){
  const statePath=required(process.env.HERCULES_BANK_STATE_PATH,"HERCULES_BANK_STATE_PATH");
  const baseAuthUrl=required(process.env.HERCULES_BASE_AUTH_URL,"HERCULES_BASE_AUTH_URL");
  const complianceStatePath=process.env.HERCULES_BANK_COMPLIANCE_STATE_PATH?.trim()||undefined;
  const jwtSecret=required(process.env.HERCULES_BASE_JWT_SECRET,"HERCULES_BASE_JWT_SECRET");
  const host=process.env.HERCULES_BANK_HOST?.trim()||"127.0.0.1";
  const currency=process.env.HERCULES_BANK_CURRENCY?.trim()||"USD";
  const port=Number(process.env.HERCULES_BANK_PORT?.trim()||"38930");
  if(!Number.isInteger(port)||port<1||port>65535)throw new TypeError("HERCULES_BANK_PORT is invalid");
  const secureSessionCookies=(process.env.HERCULES_BANK_SECURE_COOKIES??"false").trim().toLowerCase()==="true";

  const service=await startHerculesFinancialService({
    statePath,
    complianceStatePath,
    baseAuthUrl,
    jwtSecret,
    host,
    port,
    currency,
    secureSessionCookies,
  });

  console.log(JSON.stringify({
    ok:true,
    service:"hercules-financial",
    mode:service.runtime.mode,
    currency:service.runtime.currency,
    endpoint:service.endpoint,
    browserSessions:true,
    complianceOperations:true,
    externalRails:false,
  }));

  const shutdown=()=>service.server.close(()=>process.exit(0));
  process.once("SIGINT",shutdown);
  process.once("SIGTERM",shutdown);
}

const invoked=process.argv[1]?fileURLToPath(import.meta.url)===process.argv[1]:false;
if(invoked){
  main().catch((error)=>{
    console.error(error.message);
    process.exitCode=1;
  });
}
