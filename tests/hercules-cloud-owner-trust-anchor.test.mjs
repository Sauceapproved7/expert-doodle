import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {OWNER_ANCHOR_PATH,assertOwnerTrustAnchorMetadata} from "../hercules-deploy/cloud/owner-trust-anchor.mjs";

const rootDir={uid:0,mode:0o40755,isDirectory:()=>true,isSymbolicLink:()=>false};
const file={uid:0,mode:0o100644,isFile:()=>true,isSymbolicLink:()=>false,size:113};
const acceptable=(overrides={})=>({
 path:"/etc/hercules-cloud/owner-ed25519.pub",etcStat:rootDir,dirStat:rootDir,fileStat:file,
 runningUid:1000,...overrides
});
test("uses a fixed root-managed owner verification key path, not operator-controlled environment",()=>{
 assert.equal(OWNER_ANCHOR_PATH,"/etc/hercules-cloud/owner-ed25519.pub");
 assert.equal(assertOwnerTrustAnchorMetadata(acceptable()).rootTrustAnchorVerified,true);
 const cli=readFileSync(new URL("../hercules-deploy/cloud/host-engine-cli.mjs",import.meta.url),"utf8");
 assert.ok(cli.includes("loadOwnerTrustAnchor("));
 assert.equal(cli.includes("HERCULES_HOST_ENGINE_OWNER_PUBLIC_KEY_FILE"),false);
 assert.equal(cli.includes("HERCULES_HOST_ENGINE_OWNER_KEY_FILE"),false);
});
test("root-owned nonwritable /etc, trust directory and public key must all be present",()=>{
 for(const change of [
  {path:"/tmp/owner.pub"},{path:"/home/runner/owner-ed25519.pub"},
  {etcStat:{...rootDir,uid:1000}},
  {etcStat:{...rootDir,mode:0o40777}},
  {dirStat:{...rootDir,uid:1000}},
  {dirStat:{...rootDir,mode:0o40775}},
  {dirStat:{...rootDir,isSymbolicLink:()=>true}},
  {dirStat:{...rootDir,isDirectory:()=>false}},
  {fileStat:{...file,uid:1000}},
  {fileStat:{...file,mode:0o100666}},
  {fileStat:{...file,isSymbolicLink:()=>true}},
  {fileStat:{...file,isFile:()=>false}},
  {fileStat:{...file,size:0}},
  {fileStat:{...file,size:99999}},
  {runningUid:0},{runningUid:999},{runningUid:undefined}
 ]){
  assert.throws(()=>assertOwnerTrustAnchorMetadata(acceptable(change)),/owner_trust_anchor_unverified/);
 }
});
test("missing, contradictory or forged metadata is not valid authority",()=>{
 for(const m of [null,{},[],acceptable({dirStat:null}),acceptable({fileStat:{mode:0o100644,uid:0,size:113}})]){
  assert.throws(()=>assertOwnerTrustAnchorMetadata(m),/owner_trust_anchor_unverified/);
 }
});
test("legacy owner-supplied public-key path must not remain in the operator source",()=>{
 const src=readFileSync(new URL("../hercules-deploy/cloud/host-engine-cli.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(src,/readRestricted\(keyPath|ownerPublicKey=await readRestricted/);
});
