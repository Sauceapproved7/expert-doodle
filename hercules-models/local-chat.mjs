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
  enabled=false, endpoint=DEFAULT_ENDPOINT, model="", protocol="ollama",
  fetchImpl=globalThis.fetch
}={}){
  if(typeof enabled!=="boolean")throw new TypeError("local chat enabled must be a boolean");
  const origin=checkLoopbackEndpoint(endpoint);
  if(typeof fetchImpl!=="function")throw new TypeError("local chat fetch implementation required");
  const modelName=typeof model==="string"?model.trim():"";
  if(enabled && (!modelName || modelName.length>128 ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]*$/.test(modelName))){
    throw new TypeError("local chat exact model must be configured");
  }
  if(!["ollama","llama-cpp"].includes(protocol)){
    throw new TypeError("unsupported local chat protocol");
  }
  const status=()=>Object.freeze({
    enabled,backend:"loopback-only",protocol,modelConfigured:Boolean(modelName),
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
      // Preserve the previous Ollama contract. llama.cpp uses OpenAI-shaped
      // inventory and chat response structures, but NEVER a remote URL.
      const llama=protocol==="llama-cpp";
      const inventory=await getJson(fetchImpl,origin+(llama?"/v1/models":"/api/tags"),{
        method:"GET",headers:{accept:"application/json"}
      });
      const advertised=llama?inventory.data:inventory.models;
      if(!Array.isArray(advertised)||
        !advertised.some(item=>item &&
          (llama?item.id:item.name)===modelName)){
        throw error("local_chat_model_unavailable",503);
      }
      const response=await getJson(fetchImpl,origin+(llama?"/v1/chat/completions":"/api/chat"),{
        method:"POST",
        headers:{"content-type":"application/json",accept:"application/json"},
        body:JSON.stringify(llama
          ?{model:modelName,stream:false,temperature:0,max_tokens:count,
              messages:[{role:"user",content:prompt.trim()}]}
          :{model:modelName,stream:false,messages:[{role:"user",content:prompt.trim()}],
              options:{num_predict:count}})
      });
      const candidate=llama?response.choices?.[0]?.message:response.message;
      const content=candidate?.content;
      const complete=llama?
        (Array.isArray(response.choices) && response.choices.length===1 &&
          response.choices[0]?.finish_reason==="stop"):
        response.done===true;
      if(!complete || response.model!==modelName ||
        candidate?.role!=="assistant" ||
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
