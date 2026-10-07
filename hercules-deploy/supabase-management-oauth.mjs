import crypto from "node:crypto";

const BASE="https://api.supabase.com";
const AUTHORIZE=BASE+"/v1/oauth/authorize";
const TOKEN=BASE+"/v1/oauth/token";

function required(value,name,min=1){
  const v=String(value??"").trim();
  if(v.length<min)throw new TypeError(name+" is required");
  return v;
}
function b64url(buf){return Buffer.from(buf).toString("base64url");}
function challenge(verifier){return b64url(crypto.createHash("sha256").update(verifier).digest());}
function normalizeToken(body){
  if(!body||typeof body!=="object"||!body.access_token)throw new Error("Supabase OAuth token response is invalid");
  return {
    accessToken:String(body.access_token),
    refreshToken:body.refresh_token?String(body.refresh_token):null,
    expiresIn:Number(body.expires_in||0),
    tokenType:String(body.token_type||"Bearer"),
  };
}

export class SupabaseManagementOAuthClient{
  constructor({clientId,clientSecret,redirectUri,fetchImpl=globalThis.fetch}={}){
    this.clientId=required(clientId,"clientId");
    this.clientSecret=required(clientSecret,"clientSecret");
    const redirect=new URL(required(redirectUri,"redirectUri"));
    if(redirect.protocol!=="https:"||redirect.username||redirect.password||redirect.hash)throw new TypeError("redirectUri must be a credential-free HTTPS URL");
    if(typeof fetchImpl!=="function")throw new TypeError("fetch implementation is required");
    this.redirectUri=redirect.toString();
    this.fetchImpl=fetchImpl;
  }

  async beginAuthorization({state,codeVerifier,organizationSlug}={}){
    const safeState=required(state,"state",8);
    const verifier=required(codeVerifier,"codeVerifier",43);
    if(verifier.length>128)throw new TypeError("codeVerifier is too long");
    const url=new URL(AUTHORIZE);
    url.searchParams.set("client_id",this.clientId);
    url.searchParams.set("response_type","code");
    url.searchParams.set("redirect_uri",this.redirectUri);
    url.searchParams.set("state",safeState);
    url.searchParams.set("code_challenge",challenge(verifier));
    url.searchParams.set("code_challenge_method","S256");
    if(organizationSlug)url.searchParams.set("organization_slug",String(organizationSlug));
    return {authorizationUrl:url.toString(),state:safeState};
  }

  basicAuth(){
    return "Basic "+Buffer.from(this.clientId+":"+this.clientSecret).toString("base64");
  }

  async postToken(params){
    const response=await this.fetchImpl(TOKEN,{
      method:"POST",
      redirect:"error",
      cache:"no-store",
      headers:{
        authorization:this.basicAuth(),
        accept:"application/json",
        "content-type":"application/x-www-form-urlencoded",
      },
      body:params.toString(),
    });
    const body=await response.json().catch(()=>null);
    if(!response.ok)throw new Error("Supabase OAuth token request failed with status "+response.status);
    return normalizeToken(body);
  }

  async exchangeCode({code,codeVerifier}={}){
    const params=new URLSearchParams({
      grant_type:"authorization_code",
      code:required(code,"code"),
      redirect_uri:this.redirectUri,
      code_verifier:required(codeVerifier,"codeVerifier",43),
    });
    return this.postToken(params);
  }

  async refresh({refreshToken}={}){
    return this.postToken(new URLSearchParams({
      grant_type:"refresh_token",
      refresh_token:required(refreshToken,"refreshToken"),
    }));
  }
}
