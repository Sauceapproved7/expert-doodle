import {createHash} from "node:crypto";

import {
  validateTransactionalFinancialStoreAdapter,
  validateSecretCustodyAdapter,
} from "./production-readiness.mjs";

function nonEmpty(value,label,max=256){
  if(typeof value!=="string"||value.trim()==="")throw new TypeError(label+" must be a non-empty string");
  const normalized=value.trim();
  if(normalized.length>max)throw new TypeError(label+" is too long");
  return normalized;
}

function asErrorMessage(error){
  return error instanceof Error?error.message:String(error);
}

function productionEnvironment(value,label){
  const environment=nonEmpty(value,label,32);
  if(environment!=="production")throw new TypeError(label+" must be production");
  return environment;
}

export function validateProviderQualificationAdapter(adapter){
  if(!adapter||typeof adapter!=="object")throw new TypeError("provider qualification adapter is required");
  const providerId=nonEmpty(adapter.providerId,"providerId",128);
  const environment=productionEnvironment(adapter.environment,"provider environment");
  const endpoint=new URL(nonEmpty(adapter.endpoint,"provider endpoint",2048));
  if(endpoint.protocol!=="https:")throw new TypeError("production provider qualification endpoint must use HTTPS");
  for(const method of ["healthCheck","describeCapabilities"]){
    if(typeof adapter[method]!=="function")throw new TypeError(method+" provider qualification method is required");
  }
  return Object.freeze({
    providerId,
    environment,
    endpoint:endpoint.toString().replace(/\/$/,""),
    healthCheck:adapter.healthCheck,
    describeCapabilities:adapter.describeCapabilities,
  });
}

async function qualifyStore(candidate){
  const adapter=validateTransactionalFinancialStoreAdapter(candidate);
  const health=await adapter.healthCheck();
  if(!health||health.ok!==true)throw new Error("transactional store health check failed");

  const transactionToken="hercules-financial-qualification";
  const roundTrip=await adapter.withTransaction(async()=>transactionToken);
  if(roundTrip!==transactionToken)throw new Error("transactional store transaction round-trip failed");

  const backup=await adapter.createBackup({purpose:"qualification"});
  if(!backup||typeof backup!=="object"||typeof backup.id!=="string"||backup.id.trim()===""){
    throw new Error("transactional store backup creation did not return a backup id");
  }

  const restore=await adapter.verifyRestore({backup,mode:"isolated"});
  if(!restore||restore.ok!==true)throw new Error("transactional store restore verification failed");
  if(restore.isolated!==true)throw new Error("transactional store restore verification must be isolated");

  return Object.freeze({
    qualified:true,
    id:adapter.id,
    environment:adapter.environment,
    health:true,
    transactionRoundTrip:true,
    backupCreated:true,
    restoreVerified:true,
  });
}

async function qualifyCustody(candidate){
  const adapter=validateSecretCustodyAdapter(candidate);
  const key=await adapter.describeKey();
  if(!key||typeof key!=="object")throw new Error("secret custody key metadata is required");
  const keyId=nonEmpty(key.keyId,"secret custody keyId",256);
  if(key.exportable!==false)throw new Error("secret custody key must be non-exportable");
  if(key.rotationEnabled!==true)throw new Error("secret custody key rotation must be enabled");

  const digest=createHash("sha256").update("hercules-financial-adapter-qualification-v1.2").digest();
  const signature=await adapter.signDigest(digest);
  if(!(signature instanceof Uint8Array)||signature.byteLength===0){
    throw new Error("secret custody signing verification failed");
  }

  return Object.freeze({
    qualified:true,
    providerId:adapter.providerId,
    environment:adapter.environment,
    keyId,
    nonExportable:true,
    rotationEnabled:true,
    signingVerified:true,
  });
}

async function qualifyProvider(candidate){
  const adapter=validateProviderQualificationAdapter(candidate);
  const health=await adapter.healthCheck();
  if(!health||health.ok!==true)throw new Error("regulated provider health check failed");

  const capabilities=await adapter.describeCapabilities();
  if(!capabilities||typeof capabilities!=="object")throw new Error("regulated provider capabilities are required");
  if(capabilities.externalMoneyMovement!==true){
    throw new Error("regulated provider external-money-movement capability is required");
  }
  if(capabilities.custodialDeposits!==true){
    throw new Error("regulated provider custodial-deposit capability is required");
  }
  if(capabilities.sandboxOrDryRun!==true){
    throw new Error("regulated provider sandbox or dry-run capability is required for qualification");
  }

  return Object.freeze({
    qualified:true,
    providerId:adapter.providerId,
    environment:adapter.environment,
    endpoint:adapter.endpoint,
    health:true,
    externalMoneyMovement:true,
    custodialDeposits:true,
    sandboxOrDryRun:true,
    submissionTested:false,
  });
}

export async function qualifyFinancialProductionAdapters({
  transactionalStore,
  secretCustody,
  regulatedProvider,
}={}){
  const blockers=[];
  const checks={};

  try{checks.transactionalStore=await qualifyStore(transactionalStore)}
  catch(error){
    blockers.push("transactionalStore: "+asErrorMessage(error));
    checks.transactionalStore=Object.freeze({qualified:false});
  }

  try{checks.secretCustody=await qualifyCustody(secretCustody)}
  catch(error){
    blockers.push("secretCustody: "+asErrorMessage(error));
    checks.secretCustody=Object.freeze({qualified:false});
  }

  try{checks.regulatedProvider=await qualifyProvider(regulatedProvider)}
  catch(error){
    blockers.push("regulatedProvider: "+asErrorMessage(error));
    checks.regulatedProvider=Object.freeze({qualified:false,submissionTested:false});
  }

  return Object.freeze({
    qualified:blockers.length===0,
    activationAllowed:false,
    externalRailsEnabled:false,
    blockers:Object.freeze(blockers),
    checks:Object.freeze(checks),
  });
}
