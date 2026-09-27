const DEFAULT_TIMEOUT_MS=5000;
const MAX_RESPONSE_BYTES=64*1024;

function nonEmpty(value,label){
  if(typeof value!=="string"||value.trim()==="")throw new TypeError(label+" must be a non-empty string");
  return value.trim();
}

function normalizeBaseUrl(value){
  const url=new URL(nonEmpty(value,"baseUrl"));
  if(!["http:","https:"].includes(url.protocol))throw new TypeError("baseUrl protocol is not allowed");
  url.pathname=url.pathname.replace(/\/$/,"");
  url.search="";
  url.hash="";
  return url;
}

async function readJsonBounded(response){
  const reader=response.body?.getReader?.();
  if(!reader){
    const text=await response.text();
    if(Buffer.byteLength(text)>MAX_RESPONSE_BYTES)throw new Error("Base Auth response too large");
    return JSON.parse(text||"{}");
  }
  let total=0;
  const chunks=[];
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    total+=value.byteLength;
    if(total>MAX_RESPONSE_BYTES)throw new Error("Base Auth response too large");
    chunks.push(value);
  }
  const bytes=Buffer.concat(chunks.map((chunk)=>Buffer.from(chunk)));
  return JSON.parse(bytes.toString("utf8")||"{}");
}

export class HerculesBaseAuthClient{
  #baseUrl;
  #fetch;
  #timeoutMs;

  constructor({baseUrl,fetchImpl=fetch,timeoutMs=DEFAULT_TIMEOUT_MS}={}){
    if(typeof fetchImpl!=="function")throw new TypeError("fetchImpl must be a function");
    if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000)throw new TypeError("timeoutMs is invalid");
    this.#baseUrl=normalizeBaseUrl(baseUrl);
    this.#fetch=fetchImpl;
    this.#timeoutMs=timeoutMs;
  }

  signIn({email,password}={}){
    return this.#post("/v1/auth/signin",{email,password});
  }

  refresh({refresh_token}={}){
    return this.#post("/v1/auth/refresh",{refresh_token});
  }

  async logout({refresh_token}={}){
    try{
      await this.#post("/v1/auth/logout",{refresh_token});
    }catch{}
    return {ok:true};
  }

  async #post(path,body){
    const target=new URL(path,this.#baseUrl);
    const response=await this.#fetch(target,{
      method:"POST",
      redirect:"error",
      cache:"no-store",
      headers:{
        "content-type":"application/json",
        "accept":"application/json",
      },
      body:JSON.stringify(body),
      signal:AbortSignal.timeout(this.#timeoutMs),
    });

    let payload={};
    try{
      payload=await readJsonBounded(response);
    }catch(error){
      if(response.ok)throw new Error("Base authentication returned invalid JSON",{cause:error});
    }
    if(!response.ok){
      const detail=typeof payload?.error==="string"?payload.error:"authentication request failed";
      throw Object.assign(new Error("Base authentication failed ("+response.status+"): "+detail),{
        statusCode:response.status,
      });
    }
    return payload;
  }
}
