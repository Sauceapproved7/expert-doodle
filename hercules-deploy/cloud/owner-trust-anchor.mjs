// Hercules Cloud host trust root. A sandbox operator cannot substitute its
// own key when this root-admin-installed file and parent are nonwritable.
// This is local FS validation only: NOT provider, ownership or cost proof.
import {constants} from "node:fs";
import {lstat,open} from "node:fs/promises";

export const OWNER_ANCHOR_PATH="/etc/hercules-cloud/owner-ed25519.pub";
const PARENT="/etc/hercules-cloud";
function reject(){throw new Error("owner_trust_anchor_unverified")}
function trusted(st,kind){
 if(!st||st.uid!==0||!Number.isInteger(st.mode)||
    (st.mode&0o022)!==0||typeof st.isSymbolicLink!=="function"||
    st.isSymbolicLink())return false;
 const fn=kind==="file"?"isFile":"isDirectory";
 if(typeof st[fn]!=="function"||!st[fn]())return false;
 if(kind==="file"&&(!Number.isSafeInteger(st.size)||st.size<60||st.size>6000))
   return false;
 return true;
}
export function assertOwnerTrustAnchorMetadata(evidence){
 const e=evidence&&typeof evidence==="object"&&!Array.isArray(evidence)?evidence:{};
 if(e.path!==OWNER_ANCHOR_PATH||!Number.isSafeInteger(e.runningUid)||
    e.runningUid<1000||e.runningUid>65535||
    !trusted(e.etcStat,"dir")||!trusted(e.dirStat,"dir")||
    !trusted(e.fileStat,"file"))
   reject();
 return Object.freeze({
   schema:"hercules.cloud.owner-ed25519-local-anchor.v1",
   rootTrustAnchorVerified:true,
   hostOwnedByUserVerified:false,
   providerIdentityVerified:false,
   productionApproved:false
 });
}
export async function loadOwnerTrustAnchor({runningUid}={}){
 let f;
 try{
  const [etcStat,dirStat]=await Promise.all([lstat("/etc"),lstat(PARENT)]);
  // O_NONBLOCK prevents a malicious replacement FIFO from hanging an operator
  // before we can verify fstat; O_NOFOLLOW rejects a symlink.
  f=await open(OWNER_ANCHOR_PATH,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const fileStat=await f.stat();
  assertOwnerTrustAnchorMetadata({
   path:OWNER_ANCHOR_PATH,etcStat,dirStat,fileStat,runningUid
  });
  const key=(await f.readFile({encoding:"utf8"})).trim();
  if(!key.startsWith("-----BEGIN PUBLIC KEY-----")||
     !key.endsWith("-----END PUBLIC KEY-----")||key.length>6000)
     reject();
  return key;
 }catch{reject()}
 finally{await f?.close().catch(()=>{});}
}
