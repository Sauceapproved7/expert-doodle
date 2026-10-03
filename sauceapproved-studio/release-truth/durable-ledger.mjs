import {createDurableReleaseTruthAdapter} from "./durable-adapter.mjs";
import {createReleaseTruthEvidenceLedger} from "./evidence-ledger.mjs";

export async function createDurableReleaseTruthLedger({path}={}){
 let adapter,backing;
 try{
  adapter=await createDurableReleaseTruthAdapter({path});
  backing=[...(await adapter.load())];
 }catch(error){
  const wrapped=new Error("release_truth_durable_storage_unavailable");
  wrapped.cause=error;
  throw wrapped;
 }
 const ledger=createReleaseTruthEvidenceLedger({backing});

 async function record(entry={}){
  const receipt=ledger.record(entry);
  try{
   await adapter.append(receipt);
  }catch(error){
   backing.pop();
   const wrapped=new Error("release_truth_durable_storage_unavailable");
   wrapped.cause=error;
   throw wrapped;
  }
  return receipt;
 }

 async function revoke(entry={}){
  const receipt=ledger.revoke(entry);
  try{
   await adapter.append(receipt);
  }catch(error){
   backing.pop();
   const wrapped=new Error("release_truth_durable_storage_unavailable");
   wrapped.cause=error;
   throw wrapped;
  }
  return receipt;
 }

 return Object.freeze({
  record,revoke,
  history:ledger.history,
  currentEvidence:ledger.currentEvidence,
  storage:Object.freeze({kind:"hercules-owned-jsonl",durable:true,path})
 });
}
