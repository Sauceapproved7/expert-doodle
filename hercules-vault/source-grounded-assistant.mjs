import http from "node:http";
import {createHash, timingSafeEqual} from "node:crypto";
import {trainNativeRetriever,rerankDocuments,features} from "../hercules-training/native-retrieval.mjs";

const MAX_QUESTION=512,MAX_DOCUMENT_BYTES=65536,MAX_BODY=12288,MAX_EXCERPT=760;
const SAFE_PATH=/^docs\/[A-Za-z0-9][A-Za-z0-9_./-]*\.md$/;
const RISKY_SECRET=/(?:bearer\s+[A-Za-z0-9._-]{8,}|sk-[A-Za-z0-9_-]{12,}|(?:password|api[_-]?key|client[_-]?secret)\s*[=:]\s*\S{6,})/i;

function validatePath(path) {
  return typeof path==="string" && SAFE_PATH.test(path) && !path.includes("..") &&
    !path.includes("//") && !path.includes("/./");
}
function asChunks(path,content,sha256) {
  const chunks=[],lines=content.split(/\r?\n/);
  let group=[],first=0,length=0;
  function emit(){
    if(!group.length) return;
    const text=group.join("\n").trim();
    if(text && !/^#{1,6}\s+[^\n]+$/.test(text)) {
      chunks.push({id:"excerpt-"+String(chunks.length)+"-"+path, path,
        text,sha256,start_line:first,end_line:first+group.length-1});
    }
    group=[];length=0;
  }
  for(let i=0;i<lines.length;i++){
    const l=lines[i];
    if(!l.trim()){emit();continue;}
    if(l.length>MAX_EXCERPT){
      // Long code lines are not safe, useful evidence excerpts.
      emit();continue;
    }
    if(group.length && length+l.length+1>MAX_EXCERPT)emit();
    if(!group.length)first=i+1;
    group.push(l);length+=l.length+1;
  }
  emit();
  return chunks;
}
export function buildVaultIndex(documents){
  if(!Array.isArray(documents)||documents.length<2||documents.length>12)
    throw new TypeError("two to twelve allowlisted documents required");
  const seen=new Set(),parts=[];
  for(const doc of documents){
    if(!validatePath(doc?.path))throw new TypeError("invalid document path");
    if(seen.has(doc.path))throw new TypeError("duplicate document path");
    seen.add(doc.path);
    if(typeof doc.content!=="string"||!doc.content.trim())throw new TypeError("empty document");
    if(Buffer.byteLength(doc.content)>MAX_DOCUMENT_BYTES)throw new TypeError("document too large");
    if(RISKY_SECRET.test(doc.content))throw new TypeError("sensitive document contents");
    const sha256=createHash("sha256").update(doc.content,"utf8").digest("hex");
    parts.push(...asChunks(doc.path,doc.content,sha256));
  }
  if(parts.length<2)throw new TypeError("not enough source documents");
  return {chunks:parts,model:trainNativeRetriever(parts.map(({id,text})=>({id,text})))};
}
function terms(text){
  return new Set(features(text).filter(f=>f.startsWith("w:")));
}
export function answerFromVault(index,query){
  if(typeof query!=="string"||!query.trim()||query.length>MAX_QUESTION)
    throw new TypeError("invalid query length");
  if(!index||!Array.isArray(index.chunks)||!index.model)
    throw new TypeError("invalid Vault index");
  const queryTerms=terms(query),sourceById=new Map(index.chunks.map(c=>[c.id,c]));
  const ranked=rerankDocuments(index.model,query,index.chunks.map(({id,text})=>({id,text})));
  const matched=ranked.find(item=>{
    if(!(item.score>0.01))return false;
    const snippet=sourceById.get(item.id);
    const overlap=[...queryTerms].filter(t=>terms(snippet.text).has(t)).length;
    return overlap>=2;
  });
  const standard={response_type:"source_excerpt",general_chat_verified:false,
    public_release_approved:false,command_executed:false,source_material_status:"repo_documentation_not_external_fact_check"};
  if(!matched)return {...standard,found:false,answer:null,sources:[]};
  const item=sourceById.get(matched.id);
  return {...standard,found:true,answer:item.text,sources:[{
    path:item.path,start_line:item.start_line,end_line:item.end_line,sha256:item.sha256,
  }]};
}
function send(res,status,obj){
  res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store",
    "x-content-type-options":"nosniff","referrer-policy":"no-referrer",
    "content-security-policy":"default-src 'none'","x-frame-options":"DENY"});
  res.end(JSON.stringify(obj));
}
function authenticated(req,token) {
  const header=String(req.headers.authorization??"");
  if(!header.startsWith("Bearer "))return false;
  const provided=Buffer.from(header.slice(7)),expected=Buffer.from(token);
  return provided.length===expected.length && timingSafeEqual(provided,expected);
}
async function parseBody(req){
  const n=Number(req.headers["content-length"]??0);
  if(Number.isFinite(n)&&n>MAX_BODY)throw Object.assign(new Error("too big"),{status:413});
  let length=0;const chunks=[];
  for await(const part of req){
    length+=part.length;
    if(length>MAX_BODY)throw Object.assign(new Error("too big"),{status:413});
    chunks.push(part);
  }
  try{
    const data=JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if(!data||typeof data!=="object"||Array.isArray(data)||Object.keys(data).length!==1||
      !Object.hasOwn(data,"query"))throw new TypeError();
    return data;
  }catch{throw Object.assign(new Error("invalid"),{status:400});}
}
export function createVaultServer({token,index}={}){
  if(typeof token!=="string"||token.length<32)throw new TypeError("strong token required");
  if(!index?.model||!Array.isArray(index.chunks))throw new TypeError("allowlisted corpus required");
  return http.createServer(async(req,res)=>{
    const path=new URL(req.url,"http://hercules-vault.local").pathname;
    if(req.method==="GET"&&path==="/health")return send(res,200,{
      ok:true,service:"hercules-vault-source-assistant",experimental:true,
      general_chat_verified:false,public_release_approved:false});
    if(req.method!=="POST"||path!=="/v1/vault/ask")return send(res,404,{error:"not_found"});
    if(!authenticated(req,token))return send(res,401,{error:"unauthorized"});
    if(!/^application\/json(?:;|$)/i.test(req.headers["content-type"]??""))
      return send(res,415,{error:"unsupported_media_type"});
    try{
      const obj=await parseBody(req);
      const out=answerFromVault(index,obj.query);
      return send(res,200,out);
    }catch(e){
      const status=e?.status===413?413:400;
      return send(res,status,{error:status===413?"request_too_large":"invalid_request"});
    }
  });
}
