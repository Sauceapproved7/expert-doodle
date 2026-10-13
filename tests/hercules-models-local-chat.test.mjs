import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {createLocalChatAdapter} from "../hercules-models/local-chat.mjs";
import {createModelPlaneService} from "../hercules-models/service.mjs";

const token = "m".repeat(24);

async function serve(handler) {
  const requests=[];
  const server=http.createServer(async(req,res)=>{
    let text="";
    for await(const chunk of req)text+=chunk;
    requests.push({method:req.method,path:req.url,body:text});
    const {status=200,body={}}=await handler(req,text);
    res.writeHead(status,{"content-type":"application/json"});
    res.end(JSON.stringify(body));
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  return {
    origin:"http://127.0.0.1:"+server.address().port,
    requests,
    async close(){await new Promise(resolve=>server.close(resolve));}
  };
}

test("no model configuration is disabled without networking",async()=>{
  const adapter=createLocalChatAdapter({});
  assert.equal(adapter.status().enabled,false);
  await assert.rejects(adapter.chat({prompt:"Hello"}),{code:"local_chat_disabled"});
});

test("loopback-only URL rejects network and credentials",()=>{
  for(const endpoint of [
    "https://models.example.org:11434",
    "http://192.168.1.2:11434",
    "http://localhost:11434",
    "http://127.0.0.1:11434@evil.test",
    "http://user:pass@127.0.0.1:11434",
    "http://127.0.0.1:11434/redirect",
    "file:///etc/hosts",
  ]) {
    assert.throws(()=>createLocalChatAdapter({
      enabled:true,endpoint,model:"smollm2:135m"
    }),/loopback|endpoint/i);
  }
});

test("actual local provider reply is required and model is exact",async()=>{
  const backend=await serve(async(req,text)=>{
    if(req.method==="GET"&&req.url==="/api/tags")
      return {body:{models:[{name:"smollm2:135m"}]}};
    if(req.method==="POST"&&req.url==="/api/chat") {
      const data=JSON.parse(text);
      assert.equal(data.model,"smollm2:135m");
      assert.equal(data.stream,false);
      assert.equal(data.messages[0].content,"What is Hercules?");
      assert.ok(data.options.num_predict<=128);
      return {body:{model:"smollm2:135m",done:true,message:{
        role:"assistant",content:"Hercules is an AI software platform."
      }}};
    }
    return {status:404,body:{error:"not-found"}};
  });
  try {
    const adapter=createLocalChatAdapter({enabled:true,endpoint:backend.origin,model:"smollm2:135m"});
    const result=await adapter.chat({prompt:"What is Hercules?"});
    assert.equal(result.outputText,"Hercules is an AI software platform.");
    assert.equal(result.origin,"local-loopback");
    assert.equal(result.inferenceVerified,true);
    assert.deepEqual(backend.requests.map(x=>x.path),["/api/tags","/api/chat"]);
  } finally {await backend.close();}
});

test("missing model is fail-closed without generating",async()=>{
  const backend=await serve(async()=>({body:{models:[{name:"other:latest"}]}}));
  try{
    const adapter=createLocalChatAdapter({enabled:true,endpoint:backend.origin,model:"smollm2:135m"});
    await assert.rejects(adapter.chat({prompt:"Hello"}),{code:"local_chat_model_unavailable"});
    assert.equal(backend.requests.length,1);
  }finally{await backend.close();}
});

test("invalid and empty provider replies never count as generation",async()=>{
  for(const answer of [
    {model:"wrong:latest",done:true,message:{role:"assistant",content:"Some text"}},
    {model:"smollm2:135m",done:true,message:{role:"assistant",content:"  "}},
    {model:"smollm2:135m",done:false,message:{role:"assistant",content:"Partial"}},
  ]){
    const backend=await serve(async(req)=>req.url==="/api/tags"
      ?{body:{models:[{name:"smollm2:135m"}]}}:{body:answer});
    try{
      const adapter=createLocalChatAdapter({enabled:true,endpoint:backend.origin,model:"smollm2:135m"});
      await assert.rejects(adapter.chat({prompt:"Hello"}),{code:"local_chat_inference_invalid"});
    }finally{await backend.close();}
  }
});

test("model-plane local chat is token-protected and disabled by default",async()=>{
  const disabled=createModelPlaneService({models:[],token});
  await new Promise(resolve=>disabled.listen(0,"127.0.0.1",resolve));
  const origin="http://127.0.0.1:"+disabled.address().port;
  try{
    const unauth=await fetch(origin+"/v1/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prompt:"Hello"})});
    assert.equal(unauth.status,401);
    const blocked=await fetch(origin+"/v1/chat",{method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify({prompt:"Hello"})});
    assert.equal(blocked.status,503);
    const b=await blocked.json();
    assert.equal(b.error,"local_chat_disabled");
    const health=await(await fetch(origin+"/health")).json();
    assert.equal(health.ok,true);
    assert.notEqual(health.chatInferenceVerified,true);
  }finally{await new Promise(resolve=>disabled.close(resolve));}
});

test("model-plane chat returns a real local provider answer without claiming launch approval",async()=>{
  const backend=await serve(async(req)=>req.url==="/api/tags"
    ?{body:{models:[{name:"smollm2:135m"}]}}
    :{body:{model:"smollm2:135m",done:true,message:{role:"assistant",content:"Generated from local model."}}}
  );
  const adapter=createLocalChatAdapter({enabled:true,endpoint:backend.origin,model:"smollm2:135m"});
  const service=createModelPlaneService({models:[],token,chatAdapter:adapter});
  await new Promise(resolve=>service.listen(0,"127.0.0.1",resolve));
  try{
    const url="http://127.0.0.1:"+service.address().port+"/v1/chat";
    const res=await fetch(url,{method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify({prompt:"Hi"})});
    assert.equal(res.status,200);
    const body=await res.json();
    assert.equal(body.outputText,"Generated from local model.");
    assert.equal(body.inferenceVerified,true);
    assert.equal(body.publicReleaseApproved,false);
  } finally {
    await new Promise(resolve=>service.close(resolve));
    await backend.close();
  }
});
