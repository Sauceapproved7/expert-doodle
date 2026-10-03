import {mkdir,open,readFile} from "node:fs/promises";
import {dirname} from "node:path";

export async function createDurableReleaseTruthAdapter({path}={}){
 if(!path||typeof path!=="string") throw new Error("release_truth_durable_path_required");
 await mkdir(dirname(path),{recursive:true});

 async function load(){
  try{
   const raw=await readFile(path,"utf8");
   if(!raw.trim()) return Object.freeze([]);
   return Object.freeze(raw.split("\n").filter(Boolean).map((line,index)=>{
    try{return Object.freeze(JSON.parse(line));}
    catch{throw new Error("release_truth_durable_record_invalid:"+(index+1));}
   }));
  }catch(error){
   if(error?.code==="ENOENT") return Object.freeze([]);
   throw error;
  }
 }

 async function append(receipt={}){
  if(!receipt||typeof receipt!=="object") throw new Error("release_truth_receipt_required");
  if(!Number.isInteger(receipt.sequence)||receipt.sequence<1) throw new Error("release_truth_receipt_sequence_required");
  if(!/^[a-f0-9]{64}$/i.test(String(receipt.receiptSha256||""))) throw new Error("release_truth_receipt_sha256_required");
  const existing=await load();
  if(receipt.sequence!==existing.length+1) throw new Error("release_truth_append_sequence_mismatch");
  const handle=await open(path,"a",0o600);
  try{
   await handle.writeFile(JSON.stringify(receipt)+"\n",{encoding:"utf8"});
   await handle.sync();
  }finally{
   await handle.close();
  }
  return Object.freeze({...receipt});
 }

 return Object.freeze({load,append,path});
}
