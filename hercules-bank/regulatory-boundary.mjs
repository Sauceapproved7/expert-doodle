const BASE_REQUIRED_CONTROLS=Object.freeze([
  "partnerAuthorization",
  "jurisdictionAuthorization",
  "identityVerification",
  "amlProgram",
  "sanctionsScreening",
  "transactionMonitoring",
  "reconciliation",
  "disputes",
  "incidentResponse",
  "dataRetention",
  "legalReview",
]);

const DEPOSIT_REQUIRED_CONTROLS=Object.freeze([
  "custodialOwnershipRecords",
  "insuranceDisclosureReview",
]);

const SUPPORTED_JURISDICTIONS=new Set(["US-CT"]);
const ALLOWED_RAILS=new Set(["ACH","WIRE","RTP","FEDNOW"]);

function nonEmpty(value,label){
  if(typeof value!=="string"||value.trim()==="")throw new TypeError(label+" must be a non-empty string");
  return value.trim();
}

function validEvidence(value){
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  if(value.status!=="approved")return false;
  if(typeof value.reference!=="string"||value.reference.trim()==="")return false;
  if(typeof value.reviewedAt!=="string"||!Number.isFinite(Date.parse(value.reviewedAt)))return false;
  return true;
}

function providerBlockers(provider,programType){
  const blockers=[];
  if(!provider||typeof provider!=="object"){
    return ["provider: regulated provider configuration is required"];
  }
  if(typeof provider.id!=="string"||provider.id.trim()===""){
    blockers.push("provider.id: regulated provider contract identifier is required");
  }
  if(provider.environment!=="production"){
    blockers.push("provider.environment: production provider authorization is required");
  }
  try{
    const endpoint=new URL(provider.endpoint);
    if(endpoint.protocol!=="https:")blockers.push("provider.endpoint: production provider endpoint must use HTTPS");
  }catch{
    blockers.push("provider.endpoint: valid production HTTPS endpoint is required");
  }
  const capabilities=Array.isArray(provider.capabilities)?new Set(provider.capabilities):new Set();
  if(!capabilities.has("external_money_movement")){
    blockers.push("provider.capabilities: external_money_movement capability is required");
  }
  if(programType==="deposit_program"&&!capabilities.has("custodial_deposits")){
    blockers.push("provider.capabilities: custodial_deposits capability is required for a deposit program");
  }
  return blockers;
}

export function evaluateRegulatedMoneyReadiness(config={}){
  const blockers=[];
  if(config.mode!=="production")blockers.push("mode: production mode is required");
  if(!SUPPORTED_JURISDICTIONS.has(config.jurisdiction)){
    blockers.push("jurisdiction: v0.8 supports reviewed launch scope US-CT only");
  }
  const programType=config.programType;
  if(!["payments_program","deposit_program"].includes(programType)){
    blockers.push("programType: payments_program or deposit_program is required");
  }

  blockers.push(...providerBlockers(config.provider,programType));

  const controls=config.controls&&typeof config.controls==="object"?config.controls:{};
  const required=[...BASE_REQUIRED_CONTROLS];
  if(programType==="deposit_program")required.push(...DEPOSIT_REQUIRED_CONTROLS);

  for(const name of required){
    if(!validEvidence(controls[name])){
      blockers.push(name+": approved review evidence is required");
    }
  }

  return Object.freeze({
    ready:blockers.length===0,
    executionEnabled:false,
    jurisdiction:config.jurisdiction??null,
    programType:programType??null,
    providerId:typeof config.provider?.id==="string"?config.provider.id:null,
    blockers:Object.freeze(blockers),
  });
}

function loopback(hostname){
  const host=hostname.replace(/^\[|\]$/g,"").toLowerCase();
  return host==="127.0.0.1"||host==="localhost"||host==="::1";
}

export function validateRegulatedProviderAdapter(adapter){
  if(!adapter||typeof adapter!=="object")throw new TypeError("regulated provider adapter is required");
  const providerId=nonEmpty(adapter.providerId,"providerId");
  const environment=nonEmpty(adapter.environment,"environment");
  const endpoint=new URL(nonEmpty(adapter.endpoint,"endpoint"));

  if(!["http:","https:"].includes(endpoint.protocol)){
    throw new TypeError("provider endpoint protocol is not allowed");
  }
  if(environment==="production"&&endpoint.protocol!=="https:"){
    throw new TypeError("production regulated provider endpoint must use HTTPS");
  }
  if(environment!=="production"&&endpoint.protocol==="http:"&&!loopback(endpoint.hostname)){
    throw new TypeError("cleartext provider endpoint is allowed only on loopback outside production");
  }

  for(const method of ["submitTransfer","fetchTransfer","listSettlementRecords"]){
    if(typeof adapter[method]!=="function")throw new TypeError(method+" provider method is required");
  }

  return Object.freeze({
    providerId,
    environment,
    endpoint:endpoint.toString().replace(/\/$/,""),
    submitTransfer:adapter.submitTransfer,
    fetchTransfer:adapter.fetchTransfer,
    listSettlementRecords:adapter.listSettlementRecords,
  });
}

function settlementRecord(record,label){
  if(!record||typeof record!=="object")throw new TypeError(label+" settlement record is required");
  const reference=nonEmpty(record.reference,label+".reference");
  const currency=nonEmpty(record.currency,label+".currency").toUpperCase();
  if(!/^[A-Z]{3}$/.test(currency))throw new TypeError(label+".currency must be a three-letter code");
  if(!Number.isSafeInteger(record.amountMinor)||record.amountMinor<=0){
    throw new TypeError(label+".amountMinor must be a positive safe integer");
  }
  return {reference,currency,amountMinor:record.amountMinor};
}

export function reconcileExternalSettlements({internal=[],provider=[]}={}){
  if(!Array.isArray(internal)||!Array.isArray(provider))throw new TypeError("settlement inputs must be arrays");
  const internalRecords=internal.map((record,index)=>settlementRecord(record,"internal["+index+"]"));
  const providerRecords=provider.map((record,index)=>settlementRecord(record,"provider["+index+"]"));

  const providerByReference=new Map();
  const duplicates=[];
  for(const record of providerRecords){
    const existing=providerByReference.get(record.reference);
    if(existing){
      if(existing.length===1)duplicates.push({reference:record.reference,count:2});
      else duplicates.find((entry)=>entry.reference===record.reference).count+=1;
      existing.push(record);
    }else{
      providerByReference.set(record.reference,[record]);
    }
  }

  const internalReferences=new Set(internalRecords.map((record)=>record.reference));
  const missingProvider=[];
  const amountMismatches=[];
  const currencyMismatches=[];

  for(const record of internalRecords){
    const matches=providerByReference.get(record.reference);
    if(!matches||matches.length===0){
      missingProvider.push({reference:record.reference});
      continue;
    }
    const external=matches[0];
    if(record.amountMinor!==external.amountMinor){
      amountMismatches.push({
        reference:record.reference,
        internalAmountMinor:record.amountMinor,
        providerAmountMinor:external.amountMinor,
      });
    }
    if(record.currency!==external.currency){
      currencyMismatches.push({
        reference:record.reference,
        internalCurrency:record.currency,
        providerCurrency:external.currency,
      });
    }
  }

  const unexpectedProvider=[];
  for(const record of providerRecords){
    if(!internalReferences.has(record.reference)&&!unexpectedProvider.some((entry)=>entry.reference===record.reference)){
      unexpectedProvider.push({reference:record.reference});
    }
  }

  const ok=[
    missingProvider,
    unexpectedProvider,
    amountMismatches,
    currencyMismatches,
    duplicates,
  ].every((items)=>items.length===0);

  return Object.freeze({
    ok,
    missingProvider:Object.freeze(missingProvider),
    unexpectedProvider:Object.freeze(unexpectedProvider),
    amountMismatches:Object.freeze(amountMismatches),
    currencyMismatches:Object.freeze(currencyMismatches),
    duplicates:Object.freeze(duplicates),
  });
}

export class HerculesRegulatedRailBoundary{
  #readiness;
  #adapter;

  constructor({readiness,adapter}={}){
    this.#readiness=evaluateRegulatedMoneyReadiness(readiness);
    this.#adapter=validateRegulatedProviderAdapter(adapter);
  }

  status(){
    return this.#readiness;
  }

  prepareTransfer({fromAccountId,amountMinor,currency,rail,destinationToken}={}){
    if(!this.#readiness.ready){
      throw new Error("regulated_controls_incomplete: "+this.#readiness.blockers.join("; "));
    }
    const source=nonEmpty(fromAccountId,"fromAccountId");
    if(!Number.isSafeInteger(amountMinor)||amountMinor<=0){
      throw new TypeError("amountMinor must be a positive safe integer");
    }
    const normalizedCurrency=nonEmpty(currency,"currency").toUpperCase();
    if(!/^[A-Z]{3}$/.test(normalizedCurrency))throw new TypeError("currency must be a three-letter code");
    const normalizedRail=nonEmpty(rail,"rail").toUpperCase();
    if(!ALLOWED_RAILS.has(normalizedRail))throw new TypeError("rail is not supported");
    const destination=nonEmpty(destinationToken,"destinationToken");
    if(destination.length>256)throw new TypeError("destinationToken is too long");

    return Object.freeze({
      providerId:this.#adapter.providerId,
      fromAccountId:source,
      amountMinor,
      currency:normalizedCurrency,
      rail:normalizedRail,
      destinationToken:destination,
      executionAllowed:false,
    });
  }

  async executeTransfer(){
    throw new Error("live_rail_execution_locked");
  }
}
