import {randomUUID} from "node:crypto";
import {
  createRefreshToken,
  hashPassword,
  hashRefreshToken,
  signJwtHs256,
  verifyPassword,
} from "./auth-core.mjs";

const MAX_BODY_BYTES=8*1024;
const ACCESS_TTL_SECONDS=15*60;
const REFRESH_TTL_SECONDS=30*24*60*60;

function json(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      "content-type":"application/json; charset=utf-8",
      "cache-control":"no-store",
      "pragma":"no-cache",
      "x-content-type-options":"nosniff",
    },
  });
}

async function bodyJson(request){
  const declared=Number(request.headers.get("content-length"));
  if(Number.isFinite(declared)&&declared>MAX_BODY_BYTES){
    throw new TypeError("request body is too large");
  }
  const text=await request.text();
  if(new TextEncoder().encode(text).byteLength>MAX_BODY_BYTES){
    throw new TypeError("request body is too large");
  }
  try{return JSON.parse(text||"{}");}
  catch{throw new TypeError("invalid JSON");}
}

function normalizeEmail(value,{fixtureOnly=false}={}){
  if(typeof value!=="string")throw new TypeError("email is required");
  const email=value.trim().toLowerCase();
  if(email.length<3||email.length>320||!email.includes("@")||email.startsWith("@")||email.endsWith("@")){
    throw new TypeError("email is invalid");
  }
  if(fixtureOnly&&!email.endsWith("@fixture.invalid")){
    throw new TypeError("staging auth accepts fixture.invalid identities only");
  }
  return email;
}

function normalizePassword(value){
  if(typeof value!=="string"||value.length<12||value.length>256){
    throw new TypeError("password length is invalid");
  }
  return value;
}

function accessToken(userId,jwtSecret){
  return signJwtHs256({
    sub:userId,
    role:"staging_user",
    issuer:"hercules-base",
    audience:"hercules-base-api",
    ttlSeconds:ACCESS_TTL_SECONDS,
  },jwtSecret);
}

function sessionPayload(user,refreshToken,jwtSecret){
  return {
    user:{id:user.id,email:user.email},
    access_token:accessToken(user.id,jwtSecret),
    token_type:"bearer",
    expires_in:ACCESS_TTL_SECONDS,
    refresh_token:refreshToken,
    refresh_expires_in:REFRESH_TTL_SECONDS,
  };
}

async function createSession(store,user,jwtSecret){
  const refreshToken=createRefreshToken();
  const expiresAt=new Date(Date.now()+REFRESH_TTL_SECONDS*1000).toISOString();
  await store.createSession({
    id:randomUUID(),
    userId:user.id,
    refreshTokenHash:hashRefreshToken(refreshToken),
    expiresAt,
  });
  return sessionPayload(user,refreshToken,jwtSecret);
}

function statusForError(error){
  const text=String(error?.message||"");
  if(/duplicate key|unique constraint/i.test(text))return 409;
  if(/too large/i.test(text))return 413;
  return 400;
}

export async function routeAuthRequest(request,{
  store,
  jwtSecret,
  fixtureOnly=false,
}={}){
  if(!store||typeof store!=="object")return json({ok:false,error:"auth_store_unavailable"},503);
  if(typeof jwtSecret!=="string"||Buffer.byteLength(jwtSecret)<32){
    return json({ok:false,error:"auth_signing_unavailable"},503);
  }

  const url=new URL(request.url);

  if(request.method==="POST"&&url.pathname==="/v1/auth/signup"){
    try{
      const body=await bodyJson(request);
      const email=normalizeEmail(body.email,{fixtureOnly});
      const password=normalizePassword(body.password);
      const passwordRecord=await hashPassword(password);
      const user=await store.register({
        id:randomUUID(),
        email,
        passwordRecord,
      });
      if(!user)throw new Error("registration failed");
      const session=await createSession(store,user,jwtSecret);
      return json({ok:true,...session},201);
    }catch(error){
      return json({
        ok:false,
        error:statusForError(error)===409?"email_already_registered":"signup_failed",
      },statusForError(error));
    }
  }

  if(request.method==="POST"&&url.pathname==="/v1/auth/signin"){
    try{
      const body=await bodyJson(request);
      const email=normalizeEmail(body.email,{fixtureOnly});
      const password=normalizePassword(body.password);
      const record=await store.lookup(email);
      const valid=record&&!record.disabledAt&&await verifyPassword(password,record.passwordRecord);
      if(!valid)return json({ok:false,error:"invalid_credentials"},401);
      const session=await createSession(store,record,jwtSecret);
      return json({ok:true,...session});
    }catch(error){
      if(String(error?.message||"").includes("body is too large")){
        return json({ok:false,error:"request_body_too_large"},413);
      }
      return json({ok:false,error:"invalid_credentials"},401);
    }
  }

  if(request.method==="POST"&&url.pathname==="/v1/auth/refresh"){
    try{
      const body=await bodyJson(request);
      if(typeof body.refresh_token!=="string")throw new Error("invalid refresh token");
      const oldHash=hashRefreshToken(body.refresh_token);
      const next=createRefreshToken();
      const nextExpiresAt=new Date(Date.now()+REFRESH_TTL_SECONDS*1000).toISOString();
      const rotated=await store.rotateSession({
        refreshTokenHash:oldHash,
        newRefreshTokenHash:hashRefreshToken(next),
        newExpiresAt:nextExpiresAt,
      });
      if(!rotated)return json({ok:false,error:"invalid_refresh_token"},401);
      return json({
        ok:true,
        ...sessionPayload(rotated,next,jwtSecret),
      });
    }catch{
      return json({ok:false,error:"invalid_refresh_token"},401);
    }
  }

  if(request.method==="POST"&&url.pathname==="/v1/auth/logout"){
    try{
      const body=await bodyJson(request);
      if(typeof body.refresh_token!=="string")throw new Error("invalid refresh token");
      await store.revokeSession(hashRefreshToken(body.refresh_token));
      return json({ok:true});
    }catch{
      return json({ok:true});
    }
  }

  return json({ok:false,error:"auth_route_not_found"},404);
}
