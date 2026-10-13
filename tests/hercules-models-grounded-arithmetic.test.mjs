import test from "node:test";
import assert from "node:assert/strict";
import {solveGroundedArithmetic} from "../hercules-models/grounded-arithmetic.mjs";
import {createModelPlaneService} from "../hercules-models/service.mjs";

const expected=[
  ["2 + 2","4"],
  ["What is 2 plus 2?","4"],
  ["5 minus 3","2"],
  ["Which number is larger, 7 or 12?","12"],
  ["Which is smaller, -3 or 5?","-3"],
  ["-4 * 5","-20"]
];

test("explicit simple arithmetic and comparisons are answered deterministically",()=>{
  for(const [prompt,answer] of expected){
    const result=solveGroundedArithmetic(prompt);
    assert.equal(result.answer,answer,prompt);
    assert.equal(result.source,"hercules-deterministic-arithmetic");
    assert.equal(result.modelInferenceVerified,false);
    assert.equal(result.publicReleaseApproved,false);
    assert.equal(result.paidCommerceEnabled,false);
  }
});

test("unsupported, ambiguous, sensitive and overflow queries fail closed",()=>{
  for(const prompt of [
    "Tell me about Paris","How old am I?","I have 2 dogs and 3 cats",
    "Run this code: 2+2","2 ** 1000","1 / 0","2 + 2 or 3 + 3",
    "1+1; drop table","9 or 10","is 42 good","2+nan",
    "9007199254740991 + 5", "", 42, null, "0.3+0.4"
  ]){
    assert.throws(()=>solveGroundedArithmetic(prompt),{code:"arithmetic_unsupported"},String(prompt));
  }
});

test("bounds and near misses are handled without eval, inference or network",()=>{
  const x=solveGroundedArithmetic("1000000 - 999999");
  assert.equal(x.answer,"1");
  assert.throws(()=>solveGroundedArithmetic("100000000000 + 100000000000"),{code:"arithmetic_unsupported"});
  assert.equal(solveGroundedArithmetic("2+2").answer,"4");
});

async function start() {
 const server=createModelPlaneService({models:[],token:"test-local-arithmetic-token"});
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 return {server,url:"http://127.0.0.1:"+server.address().port};
}

test("arithmetic tool has the same Bearer authority boundary as the model plane",async()=>{
 const {server,url}=await start();
 try{
   const req={method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question:"2+2"})};
   const unauth=await fetch(url+"/v1/tools/arithmetic",req);
   assert.equal(unauth.status,401);
   const res=await fetch(url+"/v1/tools/arithmetic",{
     ...req,headers:{...req.headers,authorization:"Bearer test-local-arithmetic-token"}
   });
   assert.equal(res.status,200);
   const result=await res.json();
   assert.equal(result.answer,"4");
   assert.equal(result.modelInferenceVerified,false);
   assert.equal(result.publicReleaseApproved,false);
   const rejected=await fetch(url+"/v1/tools/arithmetic",{
     ...req,
     headers:{...req.headers,authorization:"Bearer test-local-arithmetic-token"},
     body:JSON.stringify({question:"Who owns Hercules?"})
   });
   assert.equal(rejected.status,422);
   assert.equal((await rejected.json()).error,"arithmetic_unsupported");
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test("arithmetic does not modify the /v1/chat default-disabled behavior",async()=>{
 const {server,url}=await start();
 try{
  const res=await fetch(url+"/v1/chat",{
   method:"POST",headers:{"content-type":"application/json",authorization:"Bearer test-local-arithmetic-token"},
   body:JSON.stringify({prompt:"2+2"})
  });
  assert.equal(res.status,503);
  assert.equal((await res.json()).error,"local_chat_disabled");
 }finally{await new Promise(resolve=>server.close(resolve));}
});
