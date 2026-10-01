import test from "node:test";
import assert from "node:assert/strict";
import {createStudioHttpHandler} from "../hercules-video/studio-server.mjs";

function request(handler,path){
 return new Promise((resolve,reject)=>{
  const req={method:"GET",url:path,headers:{}};
  let body="";
  const res={
   statusCode:200,
   headers:{},
   setHeader(k,v){this.headers[k]=v;},
   end(chunk=""){body+=chunk;resolve({statusCode:this.statusCode,body,headers:this.headers});}
  };
  try{handler(req,res);}catch(error){reject(error);}
 });
}

test("human Release Truth page renders from the same injected ledger-backed evidence as API status",async()=>{
 const backing=[];
 const handler=createStudioHttpHandler({releaseTruthBacking:backing});
 const api=await request(handler,"/api/studio/release-truth/status");
 const page=await request(handler,"/release-truth");
 assert.equal(api.statusCode,200);
 assert.equal(page.statusCode,200);
 const status=JSON.parse(api.body);
 assert.equal(status.releaseReady,false);
 for(const id of status.blockedSystemIds) assert.ok(page.body.includes(id));
 assert.ok(page.body.includes("Release blocked"));
});

test("human Release Truth page never fabricates a ready state",async()=>{
 const handler=createStudioHttpHandler({releaseTruthBacking:[]});
 const page=await request(handler,"/release-truth");
 assert.ok(!page.body.includes("Release ready"));
 assert.ok(page.body.includes("Synthetic evidence is not allowed"));
});
