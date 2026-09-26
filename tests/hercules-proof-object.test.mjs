import test from "node:test";
import assert from "node:assert/strict";
import {createProofObject,verifyProofObject} from "../hercules-proof/proof-object.mjs";

const input={
 intent:{id:"intent-1",summary:"Build verified artifact"},
 authorization:{actor:"owner",scope:["repo:write"],evidenceSha256:"a".repeat(64)},
 execution:{system:"hercules",actions:[{type:"FILE_WRITE",target:"x"}]},
 verification:{status:"PASSED",checks:[{name:"tests",status:"PASSED"}]},
 artifact:{type:"repository-change",ref:"commit:abc",sha256:"b".repeat(64)},
 ownership:{owner:"SauceApproved",provenance:"owner-code"},
 rollback:{ref:"commit:parent"}
};

test("same normalized work produces same proof digest",()=>{
 const a=createProofObject(input), b=createProofObject(input);
 assert.equal(a.proofSha256,b.proofSha256);
 assert.equal(a.schema,"hercules.proof.object.v1");
 assert.equal(a.executionAuthority,false);
});

test("proof binds intent authorization execution verification artifact ownership and rollback",()=>{
 const p=createProofObject(input);
 for(const key of ["intent","authorization","execution","verification","artifact","ownership","rollback"]) assert.ok(p[key]);
 assert.match(p.proofSha256,/^[a-f0-9]{64}$/);
 assert.equal(verifyProofObject(p).valid,true);
});

test("tampering is detected",()=>{
 const p=createProofObject(input);
 const changed={...p,artifact:{...p.artifact,ref:"commit:tampered"}};
 assert.equal(verifyProofObject(changed).valid,false);
});

test("invalid authorization evidence fails closed",()=>{
 assert.throws(()=>createProofObject({...input,authorization:{...input.authorization,evidenceSha256:"bad"}}),/authorization evidence/);
});
