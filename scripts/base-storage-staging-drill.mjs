import {randomBytes} from "node:crypto";

const baseUrl=process.env.HERCULES_BASE_STAGING_URL||"http://127.0.0.1:38800";
const suffix=randomBytes(8).toString("hex");
const email="storage-"+suffix+"@fixture.invalid";
const password=randomBytes(24).toString("base64url");
const bucket="private-"+suffix;
const key="docs/fixture.txt";
const payload=Buffer.from("Hercules Base storage lifecycle "+suffix);

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

const signup=await jsonPost("/v1/auth/signup",{email,password});
assert(signup.response.status===201,"storage_fixture_signup_failed");
const access=signup.data.access_token;
assert(typeof access==="string","storage_access_token_missing");

const createBucket=await jsonPost("/v1/storage/buckets",{name:bucket},access);
assert(createBucket.response.status===201,"storage_bucket_create_failed");

const upload=await fetch(baseUrl+"/v1/storage/objects/"+bucket+"/"+key,{
  method:"PUT",
  headers:{
    authorization:"Bearer "+access,
    "content-type":"text/plain",
  },
  body:payload,
  signal:AbortSignal.timeout(10000),
});
assert(upload.status===201,"storage_upload_failed");

const download=await fetch(baseUrl+"/v1/storage/objects/"+bucket+"/"+key,{
  headers:{authorization:"Bearer "+access},
  signal:AbortSignal.timeout(10000),
});
assert(download.status===200,"storage_download_failed");
const downloaded=Buffer.from(await download.arrayBuffer());
assert(downloaded.equals(payload),"storage_roundtrip_mismatch");

const list=await fetch(baseUrl+"/v1/storage/objects/"+bucket,{
  headers:{authorization:"Bearer "+access},
  signal:AbortSignal.timeout(10000),
});
assert(list.status===200,"storage_list_failed");
const listed=await list.json();
assert(Array.isArray(listed.objects)&&listed.objects.some((item)=>item.object_key===key),"storage_list_missing_object");

const deleted=await fetch(baseUrl+"/v1/storage/objects/"+bucket+"/"+key,{
  method:"DELETE",
  headers:{authorization:"Bearer "+access},
  signal:AbortSignal.timeout(10000),
});
assert(deleted.status===200,"storage_delete_failed");

const afterDelete=await fetch(baseUrl+"/v1/storage/objects/"+bucket+"/"+key,{
  headers:{authorization:"Bearer "+access},
  signal:AbortSignal.timeout(10000),
});
assert(afterDelete.status===404,"storage_deleted_object_still_visible");

console.log(JSON.stringify({
  ok:true,
  flow:"bucket-upload-download-list-delete",
  roundtrip:true,
  deletedObjectRejected:true,
  fixture:true,
}));
