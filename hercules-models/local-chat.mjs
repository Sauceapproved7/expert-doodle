// Original Hercules optional on-host inference adapter.
// No remote providers, downloads, provider keys, or public launch authority.
const DEFAULT_ENDPOINT="http://127.0.0.1:11434";
const MAX_PROMPT_CHARS=2000;
const MAX_OUTPUT_CHARS=10000;

function error(code,statusCode=503){
  return Object.assign(new Error(code),{code,statusCode});
}

function checkLoopbackEndpoint(endpoint){
  let url;
  try {url=new URL(endpoint);}catch{throw new TypeError("local chat endpoint must be loopback HTTP");}
  if(url.protocol!=="http:" || !["127.0.0.1","[::1]"].includes(url.hostname) ||
     url.username || url.password || url.search || url.hash || url.pathname!=="/"){
    throw new TypeError("local chat endpoint must be loopback HTTP without credentials or path");
  }
  return url.origin;
}

async function getJson(fetchImpl,url,opts={}){
  let response;
  try{
    response=await fetchImpl(url,{
      ...opts,
      redirect:"error",
      signal:AbortSignal.timeout(15000),
    });
  }catch{
    throw error("local_chat_transport_unavailable",503);
  }
  if(!response?.ok)throw error("local_chat_transport_unavailable",503);
  let data;
  try{data=await response.json();}catch{throw error("local_chat_inference_invalid",502);}
  if(!data || typeof data!=="object" || Array.isArray(data)) {
    throw error("local_chat_inference_invalid",502);
  }
  return data;
}

export function createLocalChatAdapter({
  enabled=false, endpoint=DEFAULT_ENDPOINT, model="",fetchImpl=globalThis.fetch
}={}){
  if(typeof enabled!=="boolean")throw new TypeError("local chat enabled must be a boolean");
  const origin=checkLoopbackEndpoint(endpoint);
  if(typeof fetchImpl!=="function")throw new TypeError("local chat fetch implementation required");
  const modelName=typeof model==="string"?model.trim():"";
  if(enabled && (!modelName || modelName.length>128 ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]*$/.test(modelName))){
    throw new TypeError("local chat exact model must be configured");
  }
  const status=()=>Object.freeze({
    enabled,backend:"loopback-only",modelConfigured:Boolean(modelName),
    inferenceVerified:false,publicReleaseApproved:false
  });
  return Object.freeze({
    status,
    async chat({prompt,maxOutputTokens=128}={}){
      if(!enabled)throw error("local_chat_disabled",503);
      if(typeof prompt!=="string"||!prompt.trim()||prompt.length>MAX_PROMPT_CHARS)
        throw error("local_chat_prompt_invalid",400);
      const count=Number(maxOutputTokens);
      if(!Number.isInteger(count)||count<1||count>128)
        throw error("local_chat_output_limit_invalid",400);
      const inventory=await getJson(fetchImpl,origin+"/api/tags",{
        method:"GET",headers:{accept:"application/json"}
      });
      if(!Array.isArray(inventory.models)||
        !inventory.models.some(item=>item&&item.name===modelName)){
        throw error("local_chat_model_unavailable",503);
      }
      const response=await getJson(fetchImpl,origin+"/api/chat",{
        method:"POST",
        headers:{"content-type":"application/json",accept:"application/json"},
        body:JSON.stringify({
          model:modelName,stream:false,messages:[{role:"user",content:prompt.trim()}],
          options:{num_predict:count}
        })
      });
      const content=response.message?.content;
      if(response.done!==true || response.model!==modelName ||
        response.message?.role!=="assistant" ||
        typeof content!=="string"||!content.trim()||
        content.length>MAX_OUTPUT_CHARS){
        throw error("local_chat_inference_invalid",502);
      }
      return Object.freeze({
        origin:"local-loopback",outputText:content.trim(),
        inferenceVerified:true,publicReleaseApproved:false
      });
    }
  });
}
