import test from "node:test";
import assert from "node:assert/strict";
import {createAuthorityLease,verifyAuthorityLease,evaluateAuthorityLease} from "../hercules-authority/authority-lease.mjs";

const base=()=>({
  subject:{type:"agent",id:"hercules"},
  intent:{id:"job-1"},
  authorization:{evidenceSha256:"a".repeat(64)},
  scope:{resources:["repo:file"],actions:["repository.update"],maxImpact:"RESOURCE"},
  validFrom:"2026-09-27T00:00:00Z",
  expiresAt:"2026-09-27T01:00:00Z"
});

test("same normalized authority lease is deterministic",()=>{const a=createAuthorityLease(base()),b=createAuthorityLease({...base(),scope:{resources:["repo:file"],actions:["repository.update"],maxImpact:"RESOURCE"}});assert.equal(a.leaseSha256,b.leaseSha256);assert.equal(verifyAuthorityLease(a).valid,true)});
test("lease never grants executable authority by itself",()=>{const l=createAuthorityLease(base());assert.equal(l.executionAuthority,false);assert.equal(l.constraints.carriesCredentials,false)});
test("matching request is within declared lease",()=>{const l=createAuthorityLease(base());const r=evaluateAuthorityLease(l,{resource:"repo:file",action:"repository.update",impact:"RESOURCE",at:"2026-09-27T00:30:00Z"});assert.equal(r.disposition,"WITHIN_DECLARED_LEASE");assert.equal(r.executionAuthority,false)});
test("expired lease fails closed",()=>{const l=createAuthorityLease(base());const r=evaluateAuthorityLease(l,{resource:"repo:file",action:"repository.update",impact:"RESOURCE",at:"2026-09-27T02:00:00Z"});assert.equal(r.disposition,"DENY");assert.ok(r.reasonCodes.includes("LEASE_EXPIRED"))});
test("out of scope resource or action fails closed",()=>{const l=createAuthorityLease(base());assert.equal(evaluateAuthorityLease(l,{resource:"other",action:"repository.update",impact:"RESOURCE",at:"2026-09-27T00:30:00Z"}).disposition,"DENY");assert.equal(evaluateAuthorityLease(l,{resource:"repo:file",action:"repository.delete",impact:"RESOURCE",at:"2026-09-27T00:30:00Z"}).disposition,"DENY")});
test("impact above ceiling fails closed",()=>{const l=createAuthorityLease(base());const r=evaluateAuthorityLease(l,{resource:"repo:file",action:"repository.update",impact:"SYSTEM",at:"2026-09-27T00:30:00Z"});assert.equal(r.disposition,"DENY");assert.ok(r.reasonCodes.includes("IMPACT_EXCEEDS_LEASE"))});
test("tampering is detected",()=>{const l=createAuthorityLease(base());l.scope.resources[0]="other";assert.equal(verifyAuthorityLease(l).valid,false)});
