import {randomBytes} from "node:crypto";

const baseUrl=process.env.HERCULES_BASE_STAGING_URL||"http://127.0.0.1:38800";

function assert(condition,message){
  if(!condition)throw new Error(message);
}

async function request(path,{method="GET",token,body}={}){
  const headers={};
  if(token)headers.authorization="Bearer "+token;
  if(body!==undefined)headers["content-type"]="application/json";
  const response=await fetch(baseUrl+path,{
    method,
    headers,
    body:body===undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(10000),
  });
  let data={};
  try{data=await response.json();}catch{}
  return {response,data};
}

const suffix=randomBytes(8).toString("hex");
const email="sparks-"+suffix+"@fixture.invalid";
const password=randomBytes(24).toString("base64url");
const signup=await request("/v1/auth/signup",{
  method:"POST",
  body:{email,password},
});
assert(signup.response.status===201,"sparks_signup_failed");
const token=signup.data.access_token;
assert(typeof token==="string","sparks_token_missing");

const name="image-"+suffix.slice(0,12);
const manifest={
  name,
  runtime:"node22",
  entrypoint:"index.mjs",
  timeoutMs:5000,
  memoryMb:128,
  network:"none",
  sourceSha256:"a".repeat(64),
};

const created=await request("/v1/functions",{
  method:"POST",
  token,
  body:manifest,
});
assert(created.response.status===201,"sparks_manifest_create_failed");
assert(created.data?.function?.name===name,"sparks_manifest_name_mismatch");

const list=await request("/v1/functions",{token});
assert(list.response.status===200,"sparks_list_failed");
assert(
  Array.isArray(list.data?.functions)&&list.data.functions.some((item)=>item.name===name),
  "sparks_manifest_missing_from_list",
);

const get=await request("/v1/functions/"+name,{token});
assert(get.response.status===200,"sparks_get_failed");
assert(get.data?.function?.name===name,"sparks_get_name_mismatch");

const invoke=await request("/v1/functions/"+name+"/invoke",{
  method:"POST",
  token,
  body:{input:{assetId:"fixture"}},
});
assert(invoke.response.status===503,"sparks_unsafe_executor_allowed");
assert(
  invoke.data?.error==="isolated_function_executor_unavailable",
  "sparks_wrong_executor_gate",
);

console.log(JSON.stringify({
  ok:true,
  product:"Hercules Base Sparks",
  flow:"register-list-get-block-unsafe-invoke",
  controlPlaneVerified:true,
  unsafeExecutionBlocked:true,
  fixture:true,
}));
