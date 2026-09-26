import {randomBytes} from "node:crypto";

const baseUrl=process.env.HERCULES_BASE_STAGING_URL||"http://127.0.0.1:38800";

function assert(condition,message){
  if(!condition)throw new Error(message);
}

async function jsonPost(path,body,token){
  const headers={"content-type":"application/json"};
  if(token)headers.authorization="Bearer "+token;
  const response=await fetch(baseUrl+path,{
    method:"POST",
    headers,
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(10000),
  });
  let data={};
  try{data=await response.json();}catch{}
  return {response,data};
}

async function createFixtureUser(label){
  const suffix=randomBytes(8).toString("hex");
  const email=label+"-"+suffix+"@fixture.invalid";
  const password=randomBytes(24).toString("base64url");
  const signup=await jsonPost("/v1/auth/signup",{email,password});
  assert(signup.response.status===201,label+"_signup_failed");
  assert(typeof signup.data?.access_token==="string",label+"_token_missing");
  return {token:signup.data.access_token};
}

async function storageFetch(path,{method="GET",token,body,contentType}={}){
  const headers={authorization:"Bearer "+token};
  if(contentType)headers["content-type"]=contentType;
  return fetch(baseUrl+path,{
    method,
    headers,
    body,
    signal:AbortSignal.timeout(10000),
  });
}

const suffix=randomBytes(8).toString("hex");
const owner=await createFixtureUser("storage-owner");
const outsider=await createFixtureUser("storage-outsider");
const bucket="private-"+suffix;
const key="docs/fixture.txt";

const createBucket=await jsonPost("/v1/storage/buckets",{name:bucket},owner.token);
assert(createBucket.response.status===201,"storage_bucket_create_failed");

const original=Buffer.from("Hercules Base storage lifecycle "+suffix);
const upload=await storageFetch(
  "/v1/storage/objects/"+bucket+"/"+key,
  {method:"PUT",token:owner.token,body:original,contentType:"text/plain"},
);
assert(upload.status===201,"storage_upload_failed");

const download=await storageFetch(
  "/v1/storage/objects/"+bucket+"/"+key,
  {token:owner.token},
);
assert(download.status===200,"storage_download_failed");
const downloaded=Buffer.from(await download.arrayBuffer());
assert(downloaded.equals(original),"storage_roundtrip_mismatch");
assert((download.headers.get("etag")||"").startsWith('"sha256-'),"storage_integrity_etag_missing");

const outsiderRead=await storageFetch(
  "/v1/storage/objects/"+bucket+"/"+key,
  {token:outsider.token},
);
assert(outsiderRead.status===404,"storage_cross_user_read_allowed");

const replacement=Buffer.from("Hercules Base storage replacement "+suffix);
const overwrite=await storageFetch(
  "/v1/storage/objects/"+bucket+"/"+key,
  {method:"PUT",token:owner.token,body:replacement,contentType:"text/plain"},
);
assert(overwrite.status===201,"storage_overwrite_failed");

const replaced=await storageFetch(
  "/v1/storage/objects/"+bucket+"/"+key,
  {token:owner.token},
);
assert(replaced.status===200,"storage_replacement_download_failed");
assert(Buffer.from(await replaced.arrayBuffer()).equals(replacement),"storage_overwrite_bytes_mismatch");

const list=await storageFetch(
  "/v1/storage/objects/"+bucket,
  {token:owner.token},
);
assert(list.status===200,"storage_list_failed");
const listed=await list.json();
assert(Array.isArray(listed.objects)&&listed.objects.some((item)=>item.object_key===key),"storage_list_missing_object");

const deleted=await storageFetch(
  "/v1/storage/objects/"+bucket+"/"+key,
  {method:"DELETE",token:owner.token},
);
assert(deleted.status===200,"storage_delete_failed");

const afterDelete=await storageFetch(
  "/v1/storage/objects/"+bucket+"/"+key,
  {token:owner.token},
);
assert(afterDelete.status===404,"storage_deleted_object_still_visible");

console.log(JSON.stringify({
  ok:true,
  flow:"bucket-upload-download-isolate-overwrite-list-delete",
  exactBytesVerified:true,
  crossUserIsolationVerified:true,
  deletedObjectRejected:true,
  fixture:true,
}));
