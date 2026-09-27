import {randomBytes as nodeRandomBytes, timingSafeEqual} from "node:crypto";

import {verifyJwtHs256} from "../hercules-base/auth-core.mjs";

const COOKIE_NAME="bank_session";

function nonEmpty(value,label){
  if(typeof value!=="string"||value.trim()==="")throw new TypeError(label+" must be a non-empty string");
  return value.trim();
}

function opaque(randomBytes,size=32){
  return Buffer.from(randomBytes(size)).toString("base64url");
}

function cookieValue(header,name){
  if(typeof header!=="string"||!header)return null;
  for(const part of header.split(";")){
    const [rawName,...rest]=part.trim().split("=");
    if(rawName!==name)continue;
    try{return decodeURIComponent(rest.join("="));}catch{return null}
  }
  return null;
}

function safeEqual(left,right){
  if(typeof left!=="string"||typeof right!=="string")return false;
  const a=Buffer.from(left),b=Buffer.from(right);
  return a.length===b.length&&timingSafeEqual(a,b);
}

function sessionCookie(token,{secure=false,maxAgeSeconds=8*60*60}={}){
  return [
    COOKIE_NAME+"="+encodeURIComponent(token),
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    secure?"Secure":null,
    "Max-Age="+String(maxAgeSeconds),
  ].filter(Boolean).join("; ");
}

function clearSessionCookie({secure=false}={}){
  return [
    COOKIE_NAME+"=",
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    secure?"Secure":null,
    "Max-Age=0",
  ].filter(Boolean).join("; ");
}

export class HerculesBankBrowserSessions{
  #authClient;
  #jwtSecret;
  #issuer;
  #audience;
  #nowSeconds;
  #randomBytes;
  #secureCookies;
  #sessions=new Map();

  constructor({
    authClient,
    jwtSecret,
    issuer="hercules-base",
    audience="hercules-base-api",
    nowSeconds=()=>Math.floor(Date.now()/1000),
    randomBytes=nodeRandomBytes,
    secureCookies=false,
  }={}){
    if(!authClient||typeof authClient.signIn!=="function")throw new TypeError("authClient.signIn is required");
    if(typeof jwtSecret!=="string"||Buffer.byteLength(jwtSecret)<32)throw new TypeError("JWT secret must be at least 32 bytes");
    if(typeof nowSeconds!=="function")throw new TypeError("nowSeconds must be a function");
    if(typeof randomBytes!=="function")throw new TypeError("randomBytes must be a function");
    this.#authClient=authClient;
    this.#jwtSecret=jwtSecret;
    this.#issuer=nonEmpty(issuer,"issuer");
    this.#audience=nonEmpty(audience,"audience");
    this.#nowSeconds=nowSeconds;
    this.#randomBytes=randomBytes;
    this.#secureCookies=Boolean(secureCookies);
  }

  async signIn({email,password}={}){
    const normalizedEmail=nonEmpty(email,"email").toLowerCase();
    const normalizedPassword=nonEmpty(password,"password");
    const result=await this.#authClient.signIn({email:normalizedEmail,password:normalizedPassword});
    const verified=this.#verifyBundle(result);
    const sessionId=opaque(this.#randomBytes);
    const csrfToken=opaque(this.#randomBytes);
    this.#sessions.set(sessionId,{
      user:Object.freeze({...verified.user}),
      accessToken:verified.accessToken,
      refreshToken:verified.refreshToken,
      csrfToken,
    });
    return Object.freeze({
      user:Object.freeze({...verified.user}),
      csrfToken,
      setCookie:sessionCookie(sessionId,{secure:this.#secureCookies}),
    });
  }

  async authenticate(req){
    const sessionId=cookieValue(req?.headers?.cookie,COOKIE_NAME);
    if(!sessionId)throw Object.assign(new Error("unauthorized"),{statusCode:401});
    const stored=this.#sessions.get(sessionId);
    if(!stored)throw Object.assign(new Error("unauthorized"),{statusCode:401});

    let claims;
    try{
      claims=this.#verifyAccess(stored.accessToken);
    }catch{
      if(typeof this.#authClient.refresh!=="function"){
        this.#sessions.delete(sessionId);
        throw Object.assign(new Error("unauthorized"),{statusCode:401});
      }
      let refreshed;
      try{
        refreshed=await this.#authClient.refresh({refresh_token:stored.refreshToken});
      }catch{
        this.#sessions.delete(sessionId);
        throw Object.assign(new Error("unauthorized"),{statusCode:401});
      }
      const verified=this.#verifyBundle(refreshed);
      if(verified.claims.sub!==stored.user.id){
        this.#sessions.delete(sessionId);
        throw Object.assign(new Error("unauthorized"),{statusCode:401});
      }
      stored.user=Object.freeze({...verified.user});
      stored.accessToken=verified.accessToken;
      stored.refreshToken=verified.refreshToken;
      claims=verified.claims;
    }

    return Object.freeze({
      sessionId,
      claims:Object.freeze({...claims}),
      user:Object.freeze({...stored.user}),
    });
  }

  requireCsrf(req,auth){
    const stored=this.#sessions.get(auth?.sessionId);
    if(!stored)throw Object.assign(new Error("unauthorized"),{statusCode:401});
    const supplied=req?.headers?.["x-bank-csrf"]??req?.headers?.["X-Bank-CSRF"]??"";
    if(!safeEqual(supplied,stored.csrfToken)){
      throw Object.assign(new Error("csrf validation failed"),{statusCode:403});
    }
  }

  rotateCsrf(auth){
    const stored=this.#sessions.get(auth?.sessionId);
    if(!stored)throw Object.assign(new Error("unauthorized"),{statusCode:401});
    stored.csrfToken=opaque(this.#randomBytes);
    return stored.csrfToken;
  }

  async logout(auth){
    const stored=this.#sessions.get(auth?.sessionId);
    if(!stored)throw Object.assign(new Error("unauthorized"),{statusCode:401});
    this.#sessions.delete(auth.sessionId);
    if(typeof this.#authClient.logout==="function"){
      try{await this.#authClient.logout({refresh_token:stored.refreshToken});}catch{}
    }
    return Object.freeze({
      ok:true,
      setCookie:clearSessionCookie({secure:this.#secureCookies}),
    });
  }

  #verifyAccess(accessToken){
    return verifyJwtHs256(accessToken,this.#jwtSecret,{
      issuer:this.#issuer,
      audience:this.#audience,
      nowSeconds:this.#nowSeconds(),
    });
  }

  #verifyBundle(result){
    if(!result||typeof result!=="object")throw new Error("Base authentication failed");
    const accessToken=nonEmpty(result.access_token,"access token");
    const refreshToken=nonEmpty(result.refresh_token,"refresh token");
    const claims=this.#verifyAccess(accessToken);
    const userId=result.user?.id??claims.sub;
    if(userId!==claims.sub)throw new Error("Base authentication subject mismatch");
    const user=Object.freeze({
      id:claims.sub,
      email:typeof result.user?.email==="string"?result.user.email:"",
    });
    return {user,claims,accessToken,refreshToken};
  }
}

export function bankSessionCookieName(){
  return COOKIE_NAME;
}
