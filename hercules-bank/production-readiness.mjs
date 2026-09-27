const APPROVED="approved";
const REQUIRED_CASES=Object.freeze([
  "fraud",
  "disputes",
  "returns",
  "complaints",
  "caseRetention",
]);
const REQUIRED_PROVIDER_CONTROLS=Object.freeze([
  "providerAuthorization",
  "regulatoryScope",
  "securityReview",
  "dataProtection",
  "auditRights",
  "businessContinuity",
  "incidentEscalation",
  "reconciliationTest",
  "exitPlan",
]);

function nonEmpty(value,label,max=256){
  if(typeof value!=="string"||value.trim()==="")throw new TypeError(label+" must be a non-empty string");
  const normalized=value.trim();
  if(normalized.length>max)throw new TypeError(label+" is too long");
  return normalized;
}

function reviewedEvidence(value,label){
  if(!value||typeof value!=="object"||Array.isArray(value))throw new TypeError(label+" approved evidence is required");
  if(value.status!==APPROVED)throw new TypeError(label+" must be approved");
  return Object.freeze({
    status:APPROVED,
    reference:nonEmpty(value.reference,label+".reference",512),
    reviewedAt:validatedTimestamp(value.reviewedAt,label+".reviewedAt"),
  });
}

function validatedTimestamp(value,label){
  const normalized=nonEmpty(value,label,64);
  if(!Number.isFinite(Date.parse(normalized)))throw new TypeError(label+" must be a valid timestamp");
  return normalized;
}

function positiveInteger(value,label,max){
  if(!Number.isSafeInteger(value)||value<=0)throw new TypeError(label+" must be a positive safe integer");
  if(max!==undefined&&value>max)throw new RangeError(label+" exceeds the supported bound");
  return value;
}

function loopback(hostname){
  const host=hostname.replace(/^\[|\]$/g,"").toLowerCase();
  return host==="127.0.0.1"||host==="localhost"||host==="::1";
}

export function validateTransactionalFinancialStoreAdapter(adapter){
  if(!adapter||typeof adapter!=="object")throw new TypeError("transactional financial store adapter is required");
  const id=nonEmpty(adapter.id,"store id");
  const environment=nonEmpty(adapter.environment,"store environment",32);
  if(environment!=="production")throw new TypeError("transactional financial store environment must be production");
  for(const method of ["withTransaction","healthCheck","createBackup","verifyRestore"]){
    if(typeof adapter[method]!=="function")throw new TypeError(method+" backup-capable transactional store method is required");
  }
  return Object.freeze({
    id,
    environment,
    withTransaction:adapter.withTransaction,
    healthCheck:adapter.healthCheck,
    createBackup:adapter.createBackup,
    verifyRestore:adapter.verifyRestore,
  });
}

export function validateSecretCustodyAdapter(adapter){
  if(!adapter||typeof adapter!=="object")throw new TypeError("secret custody adapter is required");
  if("exportSecret" in adapter||"getSecret" in adapter||"readSecret" in adapter){
    throw new TypeError("secret custody adapter must not export secret material");
  }
  const providerId=nonEmpty(adapter.providerId,"secret custody providerId");
  const environment=nonEmpty(adapter.environment,"secret custody environment",32);
  if(environment!=="production")throw new TypeError("secret custody environment must be production");
  for(const method of ["signDigest","describeKey","rotateKey"]){
    if(typeof adapter[method]!=="function")throw new TypeError(method+" secret custody method is required");
  }
  return Object.freeze({
    providerId,
    environment,
    signDigest:adapter.signDigest,
    describeKey:adapter.describeKey,
    rotateKey:adapter.rotateKey,
  });
}

export function validateRecoveryEvidence(evidence,{now=new Date().toISOString(),maxRestoreAgeDays=30}={}){
  if(!evidence||typeof evidence!=="object")throw new TypeError("recovery evidence is required");
  if(evidence.status!==APPROVED)throw new TypeError("recovery evidence must be approved");
  const nowMs=Date.parse(validatedTimestamp(now,"now"));
  const restoreTestedAt=validatedTimestamp(evidence.restoreTestedAt,"restoreTestedAt");
  const restoreMs=Date.parse(restoreTestedAt);
  const maxAgeMs=positiveInteger(maxRestoreAgeDays,"maxRestoreAgeDays",365)*24*60*60*1000;
  if(restoreMs>nowMs)throw new RangeError("restore test timestamp is in the future");
  if(nowMs-restoreMs>maxAgeMs)throw new Error("recent restore proof is required");
  const rpoMinutes=positiveInteger(evidence.rpoMinutes,"rpoMinutes",1440);
  const rtoMinutes=positiveInteger(evidence.rtoMinutes,"rtoMinutes",1440);
  return Object.freeze({
    status:APPROVED,
    backupReference:nonEmpty(evidence.backupReference,"backupReference",512),
    restoreTestReference:nonEmpty(evidence.restoreTestReference,"restoreTestReference",512),
    restoreTestedAt,
    reviewedAt:validatedTimestamp(evidence.reviewedAt,"reviewedAt"),
    rpoMinutes,
    rtoMinutes,
  });
}

export function validateFinancialCaseOperations(operations){
  if(!operations||typeof operations!=="object")throw new TypeError("financial case operations evidence is required");
  const controls={};
  for(const name of REQUIRED_CASES)controls[name]=reviewedEvidence(operations[name],name);
  return Object.freeze({
    ready:true,
    controls:Object.freeze(controls),
  });
}

export function certifyFinancialProviderOnboarding(evidence={}){
  const blockers=[];
  const controls={};
  for(const name of REQUIRED_PROVIDER_CONTROLS){
    try{controls[name]=reviewedEvidence(evidence[name],name)}
    catch{blockers.push(name+": approved evidence is required")}
  }
  return Object.freeze({
    certified:blockers.length===0,
    blockers:Object.freeze(blockers),
    controls:Object.freeze(controls),
  });
}

function validateRegulatedReadiness(value){
  if(!value||typeof value!=="object")throw new TypeError("regulatedReadiness is required");
  if(value.executionEnabled!==false)throw new Error("regulated readiness must keep execution disabled");
  if(value.ready!==true){
    const blockers=Array.isArray(value.blockers)?value.blockers:["regulated money readiness is incomplete"];
    return {ready:false,blockers};
  }
  return {ready:true,blockers:[]};
}

export function evaluateFinancialProductionReadiness({
  regulatedReadiness,
  transactionalStore,
  secretCustody,
  recoveryEvidence,
  caseOperations,
  providerCertification,
  now=new Date().toISOString(),
}={}){
  const blockers=[];
  const details={};

  try{
    const regulated=validateRegulatedReadiness(regulatedReadiness);
    if(!regulated.ready)blockers.push(...regulated.blockers.map((item)=>"regulated: "+item));
    details.regulated=regulated;
  }catch(error){blockers.push("regulated: "+error.message)}

  try{details.transactionalStore=validateTransactionalFinancialStoreAdapter(transactionalStore)}
  catch(error){blockers.push("transactionalStore: "+error.message)}

  try{details.secretCustody=validateSecretCustodyAdapter(secretCustody)}
  catch(error){blockers.push("secretCustody: "+error.message)}

  try{details.recovery=validateRecoveryEvidence(recoveryEvidence,{now})}
  catch(error){blockers.push("recovery: "+error.message)}

  try{details.caseOperations=validateFinancialCaseOperations(caseOperations)}
  catch(error){blockers.push("caseOperations: "+error.message)}

  try{
    const certification=certifyFinancialProviderOnboarding(providerCertification);
    details.providerCertification=certification;
    if(!certification.certified)blockers.push(...certification.blockers.map((item)=>"providerCertification: "+item));
  }catch(error){blockers.push("providerCertification: "+error.message)}

  return Object.freeze({
    ready:blockers.length===0,
    activationAllowed:false,
    externalRailsEnabled:false,
    blockers:Object.freeze(blockers),
    details:Object.freeze(details),
  });
}
