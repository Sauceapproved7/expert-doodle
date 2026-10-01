import {createHash} from "node:crypto";

const sha256=value=>createHash("sha256").update(value).digest("hex");
const validSha=value=>/^[a-f0-9]{64}$/i.test(String(value||""));
const sentinelSha=value=>/^0{64}$/i.test(String(value||""));
const validTimestamp=value=>typeof value==="string"&&Number.isFinite(Date.parse(value));
const stable=value=>JSON.stringify(value,Object.keys(value).sort());

export function verifyReleaseTruthEvidenceChain(backing=[]){
 if(!Array.isArray(backing)) return Object.freeze({valid:false,receiptCount:0,error:"invalid_backing"});
 let previous=null;
 for(let index=0;index<backing.length;index++){
  const receipt=backing[index];
  if(!receipt||typeof receipt!=="object") return Object.freeze({valid:false,receiptCount:index,error:"malformed_receipt"});
  if(receipt.sequence!==index+1) return Object.freeze({valid:false,receiptCount:index,error:"sequence_mismatch"});
  if((receipt.previousReceiptSha256??null)!==previous) return Object.freeze({valid:false,receiptCount:index,error:"previous_hash_mismatch"});
  const {receiptSha256,...payload}=receipt;
  if(!validSha(receiptSha256)||sha256(stable(payload))!==String(receiptSha256).toLowerCase())
   return Object.freeze({valid:false,receiptCount:index,error:"receipt_hash_mismatch"});
  previous=String(receiptSha256).toLowerCase();
 }
 return Object.freeze({valid:true,receiptCount:backing.length,error:null});
}

export function createReleaseTruthEvidenceLedger({backing=[]}={}){
 if(!Array.isArray(backing)) throw new Error("release_truth_backing_array_required");
 const integrity=verifyReleaseTruthEvidenceChain(backing);
 if(!integrity.valid) throw new Error("release_truth_receipt_chain_invalid:"+integrity.error);

 const append=entry=>{
  const previous=backing.at(-1)?.receiptSha256||null;
  const payload=Object.freeze({...entry,sequence:backing.length+1,previousReceiptSha256:previous});
  const receiptSha256=sha256(stable(payload));
  const receipt=Object.freeze({...payload,receiptSha256});
  backing.push(receipt); return receipt;
 };
 function record(entry={}){
  if(!entry.actorId||!validTimestamp(entry.recordedAt)) throw new Error("evidence_identity_and_timestamp_required");
  if(!validSha(entry.artifactSha256)||sentinelSha(entry.artifactSha256)||entry.verified!==true||entry.current!==true)
   throw new Error(sentinelSha(entry.artifactSha256)?"sentinel_hash_rejected":"verified_current_sha256_evidence_required");
  if(!entry.systemId||!entry.source) throw new Error("evidence_system_and_source_required");
  return append({type:"evidence",systemId:entry.systemId,verified:true,current:true,artifactSha256:String(entry.artifactSha256).toLowerCase(),source:entry.source,recordedAt:entry.recordedAt,actorId:entry.actorId});
 }
 function revoke(entry={}){
  if(!entry.systemId||!entry.actorId||!entry.reason||!validTimestamp(entry.recordedAt)) throw new Error("revocation_identity_timestamp_reason_required");
  return append({type:"revocation",systemId:entry.systemId,recordedAt:entry.recordedAt,actorId:entry.actorId,reason:entry.reason});
 }
 function history(){return Object.freeze([...backing]);}
 function currentEvidence(){
  const check=verifyReleaseTruthEvidenceChain(backing);
  if(!check.valid) throw new Error("release_truth_receipt_chain_invalid:"+check.error);
  const current=Object.create(null);
  for(const receipt of backing){
   if(receipt.type==="evidence") current[receipt.systemId]=Object.freeze({verified:true,current:true,artifactSha256:receipt.artifactSha256,source:receipt.source,recordedAt:receipt.recordedAt,actorId:receipt.actorId,receiptSha256:receipt.receiptSha256});
   else if(receipt.type==="revocation") delete current[receipt.systemId];
  }
  return Object.freeze(current);
 }
 return Object.freeze({record,revoke,history,currentEvidence,verifyIntegrity:()=>verifyReleaseTruthEvidenceChain(backing)});
}
