import assert from "node:assert/strict";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {
  createDeviceIdentity,
  buildActivationRequest,
  saveDeviceCredential,
  loadDeviceCredential,
  signDeviceChallenge,
  verifyDeviceChallenge,
  activateCleanerDevice,
} from "../hercules-cleaner/device-identity.mjs";

test("device identity uses a random opaque id and Ed25519 keys without hardware identifiers",()=>{
  const identity=createDeviceIdentity({platform:"win32",version:"1.0.0"});
  assert.equal(identity.schema,"sauceapproved.hercules-cleaner.device-identity");
  assert.match(identity.deviceId,/^[0-9a-f-]{36}$/i);
  assert.equal(identity.platform,"windows");
  assert.equal(identity.version,"1.0.0");
  assert.match(identity.publicKeyPem,/BEGIN PUBLIC KEY/);
  assert.match(identity.privateKeyPem,/BEGIN PRIVATE KEY/);
  assert.equal("hostname" in identity,false);
  assert.equal("serial" in identity,false);
  assert.equal("mac" in identity,false);
  assert.equal("username" in identity,false);
});

test("activation request sends only bounded product/device identity fields",()=>{
  const identity=createDeviceIdentity({platform:"linux",version:"1.0.0"});
  const request=buildActivationRequest({identity,activationCode:"HC-ABCD-1234"});
  assert.deepEqual(Object.keys(request).sort(),[
    "activationCode","deviceId","platform","productCode","publicKeyPem","version"
  ]);
  assert.equal(request.productCode,"hercules-cleaner");
  assert.equal(request.activationCode,"HC-ABCD-1234");
  assert.doesNotMatch(JSON.stringify(request),/file|path|capsule|hostname|serial|mac|username/i);
});

test("device credential storage is local and round-trips without writing private key to server payload",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hc-device-"));
  try{
    const identity=createDeviceIdentity({platform:"darwin",version:"1.0.0"});
    await saveDeviceCredential({
      stateRoot:root,
      identity,
      credential:{deviceCredential:"secret-opaque-token",activatedAt:"2026-09-29T12:00:00Z"}
    });
    const saved=await loadDeviceCredential({stateRoot:root});
    assert.equal(saved.identity.deviceId,identity.deviceId);
    assert.equal(saved.identity.privateKeyPem,identity.privateKeyPem);
    assert.equal(saved.credential.deviceCredential,"secret-opaque-token");
    const raw=await readFile(join(root,"device.json"),"utf8");
    assert.doesNotMatch(raw,/filename|recovery-vault|cleanup/i);
  }finally{await rm(root,{recursive:true,force:true})}
});

test("device challenge signatures prove possession without transmitting the private key",()=>{
  const identity=createDeviceIdentity({platform:"win32",version:"1.0.0"});
  const challenge="challenge-"+Date.now();
  const signature=signDeviceChallenge({privateKeyPem:identity.privateKeyPem,challenge});
  assert.equal(verifyDeviceChallenge({publicKeyPem:identity.publicKeyPem,challenge,signature}),true);
  assert.equal(verifyDeviceChallenge({publicKeyPem:identity.publicKeyPem,challenge:challenge+"x",signature}),false);
});

test("activation code format is strict and secrets are not accepted in metadata fields",()=>{
  const identity=createDeviceIdentity({platform:"win32",version:"1.0.0"});
  assert.throws(()=>buildActivationRequest({identity,activationCode:"bad"}),/activation code/i);
  assert.throws(()=>buildActivationRequest({identity:{...identity,platform:"windows\nfile=C:\\secret"},activationCode:"HC-ABCD-1234"}),/platform/i);
});


test("activation client performs challenge-sign-finish without sending private key or filesystem data",async()=>{
  const identity=createDeviceIdentity({platform:"win32",version:"1.0.0"});
  const calls=[];
  const fakeFetch=async(_url,init)=>{
    const body=JSON.parse(init.body);calls.push(body);
    if(body.action==="registration_challenge")return new Response(JSON.stringify({ok:true,challengeId:"11111111-1111-4111-8111-111111111111",challenge:"server-challenge",expiresAt:"2026-09-29T12:05:00Z"}),{status:200,headers:{"content-type":"application/json"}});
    if(body.action==="activate_device")return new Response(JSON.stringify({ok:true,deviceId:identity.deviceId,deviceCredential:"opaque-device-credential-123456",activatedAt:"2026-09-29T12:01:00Z"}),{status:200,headers:{"content-type":"application/json"}});
    throw new Error("unexpected action");
  };
  const result=await activateCleanerDevice({
    endpoint:"https://example.invalid/functions/v1/hercules-cleaner-device",
    identity,
    activationCode:"HC-ABCD-1234",
    fetchImpl:fakeFetch,
  });
  assert.equal(result.deviceCredential,"opaque-device-credential-123456");
  assert.equal(calls.length,2);
  assert.equal(calls[0].action,"registration_challenge");
  assert.equal(calls[1].action,"activate_device");
  const wire=JSON.stringify(calls);
  assert.doesNotMatch(wire,/PRIVATE KEY|recovery-vault|filename|filepath|cleanup/i);
  assert.match(calls[1].signature,/^[A-Za-z0-9+/=]+$/);
});


test("Cleaner CLI exposes device init, activation, and status commands",async()=>{
  const cli=await readFile(new URL("../hercules-cleaner/cli.mjs",import.meta.url),"utf8");
  assert.match(cli,/device-init/);
  assert.match(cli,/device-activate/);
  assert.match(cli,/device-status/);
  assert.match(cli,/HERCULES_CLEANER_DEVICE_ENDPOINT/);
});
