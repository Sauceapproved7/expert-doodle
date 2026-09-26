import {signJwtHs256} from "./auth-core.mjs";

function requiredUrl(value){
  const url=new URL(String(value||""));
  if(!["http:","https:"].includes(url.protocol))throw new TypeError("PostgREST URL is invalid");
  return url.origin;
}

function normalizeRows(body){
  return Array.isArray(body)?body:[];
}

export function createPostgrestAuthStore({
  postgrestUrl,
  jwtSecret,
  fetchImpl=globalThis.fetch,
}={}){
  const origin=requiredUrl(postgrestUrl);
  if(typeof fetchImpl!=="function")throw new TypeError("fetch implementation is required");

  function serviceToken(){
    return signJwtHs256({
      sub:"hercules-base-auth-service",
      role:"staging_auth",
      issuer:"hercules-base-internal",
      audience:"hercules-base-postgrest",
      ttlSeconds:300,
    },jwtSecret);
  }

  async function rpc(name,payload){
    const response=await fetchImpl(origin+"/rpc/"+name,{
      method:"POST",
      headers:{
        "content-type":"application/json",
        authorization:"Bearer "+serviceToken(),
      },
      body:JSON.stringify(payload),
      signal:AbortSignal.timeout(5000),
    });
    const text=await response.text();
    let body=null;
    if(text){
      try{body=JSON.parse(text);}catch{body={message:text};}
    }
    if(!response.ok){
      const message=body&&typeof body.message==="string"?body.message:"AUTH_STORE_ERROR";
      const error=new Error(message);
      error.status=response.status;
      throw error;
    }
    return body;
  }

  return Object.freeze({
    async register({id,email,passwordRecord}){
      const body=await rpc("auth_register",{
        p_id:id,
        p_email:email,
        p_password_digest:passwordRecord.digest,
        p_password_salt:passwordRecord.salt,
        p_password_params:passwordRecord.params,
      });
      return normalizeRows(body)[0]??null;
    },

    async lookup(email){
      const body=await rpc("auth_lookup",{p_email:email});
      const row=normalizeRows(body)[0];
      if(!row)return null;
      return {
        id:row.id,
        email:row.email,
        disabledAt:row.disabled_at??null,
        passwordRecord:{
          algorithm:row.password_params?.algorithm??"scrypt",
          digest:row.password_digest,
          salt:row.password_salt,
          params:row.password_params,
        },
      };
    },

    async createSession({id,userId,refreshTokenHash,expiresAt}){
      const body=await rpc("auth_create_session",{
        p_id:id,
        p_user_id:userId,
        p_refresh_token_hash:refreshTokenHash,
        p_expires_at:expiresAt,
      });
      return normalizeRows(body)[0]??null;
    },

    async rotateSession({refreshTokenHash,newRefreshTokenHash,newExpiresAt}){
      const body=await rpc("auth_rotate_session",{
        p_refresh_token_hash:refreshTokenHash,
        p_new_refresh_token_hash:newRefreshTokenHash,
        p_new_expires_at:newExpiresAt,
      });
      return normalizeRows(body)[0]??null;
    },

    async revokeSession(refreshTokenHash){
      return rpc("auth_revoke_session",{p_refresh_token_hash:refreshTokenHash});
    },
  });
}
