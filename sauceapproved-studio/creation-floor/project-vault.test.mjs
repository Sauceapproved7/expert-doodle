import test from "node:test";
import assert from "node:assert/strict";
import {createProjectRecord,attachVaultAsset,searchVaultAssets} from "./project-vault.mjs";

test("Project Hub creates stable project record with lifecycle state",()=>{
 const p=createProjectRecord({id:"p-1",title:"Hercules Drop",ownerId:"owner-1"});
 assert.equal(p.id,"p-1"); assert.equal(p.state,"active"); assert.equal(p.version,1); assert.deepEqual(p.assetIds,[]);
});

test("Media Vault rejects assets without provenance and rights",()=>{
 const p=createProjectRecord({id:"p-1",title:"Film",ownerId:"owner-1"});
 assert.throws(()=>attachVaultAsset(p,{id:"a-1",name:"clip.webm",kind:"video"}),/asset_provenance_and_rights_required/);
});

test("Media Vault attaches rights-aware asset and advances project version",()=>{
 const p=createProjectRecord({id:"p-1",title:"Film",ownerId:"owner-1"});
 const out=attachVaultAsset(p,{id:"a-1",name:"clip.webm",kind:"video",provenance:{source:"owner-upload"},rights:{status:"owned"}});
 assert.deepEqual(out.project.assetIds,["a-1"]); assert.equal(out.project.version,2); assert.equal(out.asset.projectId,"p-1");
 assert.equal(out.asset.proofSpine.rightsStatus,"owned");
});

test("Media Vault search is scoped to project and matches tags or name",()=>{
 const assets=[
  {id:"a1",projectId:"p1",name:"black-hoodie.webm",tags:["streetwear"]},
  {id:"a2",projectId:"p1",name:"voice.wav",tags:["dialogue"]},
  {id:"a3",projectId:"p2",name:"hoodie-other.webm",tags:["streetwear"]}
 ];
 assert.deepEqual(searchVaultAssets(assets,{projectId:"p1",query:"streetwear"}).map(x=>x.id),["a1"]);
});
