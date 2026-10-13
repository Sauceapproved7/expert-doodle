import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {proveAuthenticatedLocalChat} from "../scripts/hercules-live-model-plane-proof.mjs";

async function provider(responder) {
  const paths=[];
  const server=http.createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=Buffer.concat(chunks).toString("utf8");
    paths.push(req.url);
    const {status=200,json={}}=await responder(req,body);
    res.writeHead(status,{"content-type":"application/json"});
    res.end(JSON.stringify(json));
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  return {
    url:"http://127.0.0.1:"+server.address().port,
    paths,
    async stop(){await new Promise(resolve=>server.close(resolve))}
  };
}

test("real route probe requires bearer auth, exact model, and meaningful generation",async()=>{
  const p=await provider(async(req)=>{
    if(req.url==="/v1/models")return {json:{data:[{id:"hercules-trial"}]}};
    if(req.url==="/v1/chat/completions")return {json:{
      model:"hercules-trial",
      choices:[{message:{role:"assistant",content:"The capital is Paris."},finish_reason:"stop"}]
    }};
    return {status:404};
  });
  try {
    const proof=await proveAuthenticatedLocalChat({
      backendEndpoint:p.url,modelId:"hercules-trial",prompt:"Where is Paris?",maxOutputTokens:32
    });
    assert.equal(proof.authenticatedReplyReceived,true);
    assert.equal(proof.unauthenticatedRequestRejected,true);
    assert.equal(proof.generatedTextPresent,true);
    assert.equal(proof.sampleText,"The capital is Paris.");
    assert.ok(Number.isFinite(proof.elapsedMs)&&proof.elapsedMs>=0);
    assert.equal(proof.backend,"llama-cpp-loopback");
    assert.equal(proof.productionChatQualified,false);
    assert.equal(proof.publicReleaseApproved,false);
    assert.equal(proof.paidCommerceEnabled,false);
    assert.deepEqual(p.paths,["/v1/models","/v1/chat/completions"]);
  } finally {await p.stop()}
});

test("backend cannot be remote or resolve via user-supplied URL",async()=>{
  await assert.rejects(proveAuthenticatedLocalChat({
    backendEndpoint:"https://model.example.com",modelId:"hercules-trial",prompt:"hi"
  }),/loopback/i);
  await assert.rejects(proveAuthenticatedLocalChat({
    backendEndpoint:"http://user:pass@127.0.0.1:1234",modelId:"hercules-trial",prompt:"hi"
  }),/loopback/i);
});

test("missing model never falsely records an authenticated inference proof",async()=>{
  const p=await provider(async()=>({json:{data:[{id:"different"}]}}));
  try{await assert.rejects(
    proveAuthenticatedLocalChat({backendEndpoint:p.url,modelId:"hercules-trial",prompt:"hello"}),
    /local_chat_model_unavailable/
  );assert.deepEqual(p.paths,["/v1/models"])}
  finally{await p.stop()}
});

test("bad generation fails closed rather than treating process health as AI proof",async()=>{
  const p=await provider(async(req)=>req.url==="/v1/models"
    ?{json:{data:[{id:"hercules-trial"}]}}
    :{json:{model:"hercules-trial",choices:[{message:{role:"assistant",content:"partial"},finish_reason:"length"}]}}
  );
  try{await assert.rejects(
    proveAuthenticatedLocalChat({backendEndpoint:p.url,modelId:"hercules-trial",prompt:"hello"}),
    /local_chat_inference_invalid/
  )}finally{await p.stop()}
});
