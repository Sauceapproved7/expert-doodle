import {randomBytes} from "node:crypto";

const baseUrl=process.env.HERCULES_BASE_STAGING_URL||"http://127.0.0.1:38800";
const suffix=randomBytes(8).toString("hex");
const email="auth-"+suffix+"@fixture.invalid";
const password=randomBytes(24).toString("base64url");

async function post(path,body){
  const response=await fetch(baseUrl+path,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(10000),
  });
  let payload={};
  try{payload=await response.json();}catch{}
  return {response,payload};
}

function assert(condition,message){
  if(!condition)throw new Error(message);
}

const signup=await post("/v1/auth/signup",{email,password});
assert(signup.response.status===201,"auth_signup_failed");
assert(signup.payload?.user?.email===email,"auth_signup_identity_mismatch");
assert(typeof signup.payload?.access_token==="string","auth_signup_access_token_missing");
assert(typeof signup.payload?.refresh_token==="string","auth_signup_refresh_token_missing");

const signin=await post("/v1/auth/signin",{email,password});
assert(signin.response.status===200,"auth_signin_failed");
assert(signin.payload?.user?.email===email,"auth_signin_identity_mismatch");
const initialRefresh=signin.payload.refresh_token;
assert(typeof initialRefresh==="string","auth_signin_refresh_token_missing");

const rotated=await post("/v1/auth/refresh",{refresh_token:initialRefresh});
assert(rotated.response.status===200,"auth_refresh_failed");
assert(typeof rotated.payload?.refresh_token==="string","auth_rotated_refresh_missing");
assert(rotated.payload.refresh_token!==initialRefresh,"auth_refresh_not_rotated");

const replay=await post("/v1/auth/refresh",{refresh_token:initialRefresh});
assert(replay.response.status===401,"auth_old_refresh_replay_allowed");

const activeRefresh=rotated.payload.refresh_token;
const logout=await post("/v1/auth/logout",{refresh_token:activeRefresh});
assert(logout.response.status===200&&logout.payload?.ok===true,"auth_logout_failed");

const afterLogout=await post("/v1/auth/refresh",{refresh_token:activeRefresh});
assert(afterLogout.response.status===401,"auth_revoked_refresh_allowed");

const wrongPassword=await post("/v1/auth/signin",{email,password:password+"x"});
assert(wrongPassword.response.status===401,"auth_wrong_password_allowed");

console.log(JSON.stringify({
  ok:true,
  flow:"signup-signin-refresh-logout",
  oldRefreshReplayRejected:true,
  revokedRefreshRejected:true,
  wrongPasswordRejected:true,
  fixture:true,
}));
