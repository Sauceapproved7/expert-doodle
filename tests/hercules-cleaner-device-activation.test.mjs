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
