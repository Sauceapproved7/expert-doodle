import {HerculesBaseAuthClient} from "./base-auth-client.mjs";
import {createHerculesBankApi} from "./api.mjs";
import {HerculesBankBrowserSessions} from "./browser-session.mjs";
import {HerculesBankRuntime} from "./runtime.mjs";
import {HerculesComplianceOperations} from "./compliance-operations.mjs";
import {HerculesReadinessDriftSentinel} from "./readiness-drift.mjs";

export function createHerculesBankBrowserService({
  runtime,
  baseAuthUrl,
  jwtSecret,
  issuer="hercules-base",
  audience="hercules-base-api",
  fetchImpl=fetch,
  authTimeoutMs=5000,
  nowSeconds=()=>Math.floor(Date.now()/1000),
  randomBytes,
  secureSessionCookies=false,
  adminRoles,
  complianceOperations=null,
  productionReadinessInputs={},
  qualificationEvidenceStore=null,
  currentAdapterQualification=null,
  readinessDriftSentinel=null,
}={}){
  if(!runtime)throw new TypeError("runtime is required");
  const authClient=new HerculesBaseAuthClient({
    baseUrl:baseAuthUrl,
    fetchImpl,
    timeoutMs:authTimeoutMs,
  });
  const browserSessions=new HerculesBankBrowserSessions({
    authClient,
    jwtSecret,
    issuer,
    audience,
    nowSeconds,
    ...(randomBytes?{randomBytes}:{}),
    secureCookies:secureSessionCookies,
  });
  const server=createHerculesBankApi({
    runtime,
    jwtSecret,
    issuer,
    audience,
    nowSeconds,
    browserSessions,
    complianceOperations,
    productionReadinessInputs,
    qualificationEvidenceStore,
    currentAdapterQualification,
    readinessDriftSentinel,
    ...(adminRoles?{adminRoles}:{}),
  });
  return Object.freeze({
    server,
    runtime,
    authClient,
    browserSessions,
    complianceOperations,
    qualificationEvidenceStore,
    currentAdapterQualification,
    readinessDriftSentinel,
  });
}

export async function listenHerculesBankBrowserService({
  statePath,
  complianceStatePath,
  readinessDriftStatePath,
  readinessDriftSentinel=null,
  currency="USD",
  host="127.0.0.1",
  port=38900,
  ...options
}={}){
  const runtime=await HerculesBankRuntime.open({statePath,currency});
  const complianceOperations=await HerculesComplianceOperations.open({
    statePath:complianceStatePath??(String(statePath)+".compliance.json"),
  });
  const driftSentinel=readinessDriftSentinel??await HerculesReadinessDriftSentinel.open({
    statePath:readinessDriftStatePath??(String(statePath)+".readiness-drift.json"),
  });
  const service=createHerculesBankBrowserService({
    runtime,
    complianceOperations,
    readinessDriftSentinel:driftSentinel,
    ...options,
  });
  await new Promise((resolve,reject)=>{
    const onError=(error)=>{
      service.server.off("listening",onListening);
      reject(error);
    };
    const onListening=()=>{
      service.server.off("error",onError);
      resolve();
    };
    service.server.once("error",onError);
    service.server.once("listening",onListening);
    service.server.listen(port,host);
  });
  return service;
}
