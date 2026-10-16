/** Device-local persistence. No network transfer, payments, launch writes, or credentials. */
let dbPromise;
function database(){
 if(typeof indexedDB==="undefined")return Promise.reject(new Error("IndexedDB unavailable"));
 if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
  const request=indexedDB.open("hercules-gatehouse-device-history",1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains("history"))request.result.createObjectStore("history")};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error("Device storage unavailable"));
 }).catch(error=>{dbPromise=null;throw error});
 return dbPromise;
}
async function transact(mode,run){
 const db=await database();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("history",mode);
  const store=tx.objectStore("history");
  let result;
  const req=run(store);
  req.onsuccess=()=>{result=req.result};
  tx.oncomplete=()=>resolve(result);
  tx.onerror=()=>reject(tx.error||new Error("Device storage failed"));
  tx.onabort=()=>reject(tx.error||new Error("Device storage interrupted"));
 });
}
export async function readDeviceHistory(){
 const result=await transact("readonly",s=>s.get("public-samples"));
 return Array.isArray(result)?result:[];
}
export async function writeDeviceHistory(samples){
 if(!Array.isArray(samples))throw new TypeError("Expected observations");
 await transact("readwrite",s=>s.put(samples,"public-samples"));
}
export async function clearDeviceHistory(){
 await transact("readwrite",s=>s.delete("public-samples"));
}
