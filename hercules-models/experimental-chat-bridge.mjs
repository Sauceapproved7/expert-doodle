import http from "node:http";
import {timingSafeEqual} from "node:crypto";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_PROMPT_CHARS = 2048;
const MAX_OUTPUT_CHARS = 4096;
export const EXPERIMENTAL_MODEL_ID = "hercules-core-neural-v03-experimental";

function reply(res, status, payload, mime="application/json; charset=utf-8") {
  res.writeHead(status, {
    "content-type": mime,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  res.end(typeof payload === "string" ? payload : JSON.stringify(payload));
}
function matchesToken(value, secret) {
  if (!value.startsWith("Bearer ")) return false;
  const a = Buffer.from(value.slice(7)), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
async function readJson(req) {
  const declared = Number(req.headers["content-length"] ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw Object.assign(new Error("too large"), {status:413});
  }
  let size=0;
  const parts=[];
  for await(const chunk of req) {
    size+=chunk.length;
    if (size>MAX_BODY_BYTES) throw Object.assign(new Error("too large"), {status:413});
    parts.push(chunk);
  }
  try{
    const obj=JSON.parse(Buffer.concat(parts).toString("utf8"));
    if(!obj || typeof obj!=="object" || Array.isArray(obj)) throw new TypeError("bad shape");
    return obj;
  }catch{
    throw Object.assign(new Error("invalid json"), {status:400});
  }
}
function validateRequest(body, modelId){
  if(body.model!==modelId || !Array.isArray(body.messages) || body.messages.length<1 || body.messages.length>8) return null;
  if(body.stream!==undefined && typeof body.stream!=="boolean") return null;
  if(body.max_tokens!==undefined && (!Number.isInteger(body.max_tokens)||body.max_tokens<1)) return null;
  if(body.messages.some(m=>!m || typeof m!=="object" || !["user","assistant","system"].includes(m.role) ||
      typeof m.content!=="string" || m.content.length>MAX_PROMPT_CHARS)) return null;
  const user=[...body.messages].reverse().find(m=>m.role==="user");
  if(!user || !user.content.trim()) return null;
  return {prompt:user.content,maxTokens:Math.min(body.max_tokens??48,48),stream:body.stream===true};
}
function health(){
  return {ok:true,service:"hercules-experimental-chat-bridge",experimental:true,
    model_origin:"hercules-native",chat_quality_verified:false,public_release_approved:false,
    supports_streaming:true,conversation_memory:false};
}
export function createServer({token,modelId=EXPERIMENTAL_MODEL_ID,generate}={}){
  if(typeof token!=="string" || token.length<32 || typeof generate!=="function"){
    throw new TypeError("strong token and candidate generation function required");
  }
  if(modelId!==EXPERIMENTAL_MODEL_ID) throw new TypeError("experimental model only");
  return http.createServer(async (req,res)=>{
    const path=new URL(req.url,"http://hercules-experimental.local").pathname;
    if(req.method==="GET" && path==="/health"){
      return reply(res,200,health());
    }
    const tags=(req.method==="GET" && path==="/api/tags");
    const chat=(req.method==="POST" && path==="/v1/chat/completions");
    if(!tags&&!chat) return reply(res,404,{error:"not_found"});
    if(!matchesToken(req.headers.authorization??"",token)){
      return reply(res,401,{error:"unauthorized"});
    }
    if(tags) return reply(res,200,{models:[{
      name:modelId,size:0,modified_at:"experimental",
      details:{family:"hercules-native-experimental",parameter_size:"tiny-candidate",quantization_level:"not_applicable"}
    }],experimental:true,chat_quality_verified:false,public_release_approved:false});
    try {
      if(!String(req.headers["content-type"]??"").toLowerCase().startsWith("application/json")){
        return reply(res,415,{error:"invalid_media_type"});
      }
      const body=await readJson(req);
      const info=validateRequest(body,modelId);
      if(!info) return reply(res,400,{error:"invalid_request"});
      let result;
      try {result=await generate(info.prompt,{maxTokens:info.maxTokens});}
      catch {return reply(res,503,{error:"experimental_candidate_unavailable"});}
      const text=result?.continuation;
      if(typeof text!=="string" || !text.trim() || text.length>MAX_OUTPUT_CHARS){
        return reply(res,503,{error:"experimental_candidate_unavailable"});
      }
      const id="lab-"+Math.random().toString(36).slice(2);
      if(info.stream){
        const delta={id,object:"chat.completion.chunk",model:modelId,experimental:true,
          choices:[{index:0,delta:{role:"assistant",content:text},finish_reason:null}]};
        return reply(res,200,"data: "+JSON.stringify(delta)+"\n\ndata: [DONE]\n\n","text/event-stream; charset=utf-8");
      }
      return reply(res,200,{id,object:"chat.completion",model:modelId,experimental:true,
        chat_quality_verified:false,public_release_approved:false,
        choices:[{index:0,message:{role:"assistant",content:text},finish_reason:"stop"}]});
    }catch(err){
      return reply(res,err?.status===413?413:400,{error:err?.status===413?"request_too_large":"invalid_request"});
    }
  });
}
