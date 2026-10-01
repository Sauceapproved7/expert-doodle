import test from "node:test";
import assert from "node:assert/strict";
import {createProjectRecord,updateProjectState,duplicateProject,attachVaultAsset,searchVaultAssets} from "./project-vault.mjs";

test("Project Hub creates stable project record with lifecycle state",()=>{
 const p=createProjectRecord({id:"p-1",title:"Hercules Drop",ownerId:"owner-1"});
 assert.equal(p.id,"p-1"); assert.equal(p.state,"active"); assert.equal(p.version,1); assert.deepEqual(p.assetIds,[]);
});
test("Project Hub archives and reopens without deleting history",()=>{
 const p=createProjectRecord({id:"p-1",title:"Film",ownerId:"owner-1"});
 const archived=updateProjectState(p,"archived");
 assert.equal(archived.state,"archived"); assert.equal(archived.version,2);
 const reopened=updateProjectState(archived,"active");
 assert.equal(reopened.state,"active"); assert.equal(reopened.version,3);
 assert.throws(()=>updateProjectState(p,"deleted"),/invalid_project_state/);
});
test("Project Hub duplicates as a new owned project without silently copying asset attachments",()=>{
 const p=createProjectRecord({id:"p-1",title:"Film",ownerId:"owner-1"});
 const d=duplicateProject({...p,assetIds:["a-1"]},{id:"p-2",title:"Film Copy"});
 assert.equal(d.id,"p-2"); assert.equal(d.ownerId,"owner-1"); assert.deepEqual(d.assetIds,[]); assert.equal(d.duplicatedFrom,"p-1");
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
test("Media Vault rejects unknown rights states instead of treating them as usable",()=>{
 const p=createProjectRecord({id:"p-1",title:"Film",ownerId:"owner-1"});
 assert.throws(()=>attachVaultAsset(p,{id:"a-1",name:"clip.webm",kind:"video",provenance:{source:"upload"},rights:{status:"mystery"}}),/unsupported_asset_rights/);
});
test("Media Vault search is scoped to project and can filter kind and cleared rights",()=>{
 const assets=[
  {id:"a1",projectId:"p1",name:"black-hoodie.webm",kind:"video",tags:["streetwear"],rights:{status:"owned"}},
  {id:"a2",projectId:"p1",name:"voice.wav",kind:"audio",tags:["dialogue"],rights:{status:"pending"}},
  {id:"a3",projectId:"p2",name:"hoodie-other.webm",kind:"video",tags:["streetwear"],rights:{status:"owned"}}
 ];
 assert.deepEqual(searchVaultAssets(assets,{projectId:"p1",query:"streetwear",kind:"video",rightsReady:true}).map(x=>x.id),["a1"]);
 assert.deepEqual(searchVaultAssets(assets,{projectId:"p1",rightsReady:true}).map(x=>x.id),["a1"]);
});
