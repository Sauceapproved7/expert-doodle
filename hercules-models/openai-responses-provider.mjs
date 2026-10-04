const DEFAULT_MODEL="gpt-5.6";

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function openAIProviderReadiness(env=process.env) {
  const key=clean(env.OPENAI_API_KEY);
  if (!key) {
    return Object.freeze({ready:false,provider:"openai",reason:"missing_credential"});
  }
  return Object.freeze({
    ready:true,
    provider:"openai",
    model:clean(env.HERCULES_OPENAI_MODEL) || DEFAULT_MODEL
  });
}

export function createOpenAIResponsesProvider({
  env=process.env,
  fetchImpl=globalThis.fetch,
  endpoint="https://api.openai.com/v1/responses"
}={}) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl is required");

  return Object.freeze({
    readiness: () => openAIProviderReadiness(env),
    async respond({input,maxOutputTokens=1024}={}) {
      const state=openAIProviderReadiness(env);
      if (!state.ready) {
        throw Object.assign(new Error("openai_provider_not_ready"),{code:"openai_provider_not_ready"});
      }
      if (typeof input !== "string" || !input.trim()) throw new TypeError("input is required");
      const limit=Math.max(1,Math.min(4096,Number(maxOutputTokens) || 1024));
      const response=await fetchImpl(endpoint,{
        method:"POST",
        headers:{
          authorization:"Bearer "+clean(env.OPENAI_API_KEY),
          "content-type":"application/json"
        },
        body:JSON.stringify({model:state.model,input:input.trim(),max_output_tokens:limit})
      });
      let body={};
      try { body=await response.json(); } catch {}
      if (!response.ok) {
        throw Object.assign(new Error("openai_provider_request_failed"),{
          code:"openai_provider_request_failed",
          status:Number(response.status) || 502
        });
      }
      return Object.freeze({
        provider:"openai",
        model:state.model,
        responseId:typeof body.id === "string" ? body.id : null,
        outputText:typeof body.output_text === "string" ? body.output_text : ""
      });
    }
  });
}
