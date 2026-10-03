import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSenderConstraint,
  createReplayCache,
  redactSecurityEvent,
} from "../hercules-authority/sender-constraint.mjs";

const base={
  token:{issuer:"hercules-id",audience:"hercules-agent",tenantId:"sauceapproved",scopes:["forge:deploy"],expiresAt:"2026-10-03T06:10:00.000Z",keyThumbprint:"thumb-a"},
  proof:{keyThumbprint:"thumb-a",method:"POST",uri:"/v1/deploy",issuedAt:"2026-10-03T06:00:00.000Z",id:"proof-1"},
  expectedIssuer:"hercules-id",expectedAudience:"hercules-agent",requiredScopes:["forge:deploy"],
  method:"POST",uri:"/v1/deploy",now:"2026-10-03T06:00:00.000Z",
};

test("matching sender constraint is accepted once",()=>{
  assert.equal(evaluateSenderConstraint({...base,replayCache:createReplayCache()}).ok,true);
});

test("wrong audience fails closed",()=>{
  const result=evaluateSenderConstraint({...base,expectedAudience:"other",replayCache:createReplayCache()});
  assert.equal(result.ok,false);
  assert.ok(result.reasonCodes.includes("TOKEN_AUDIENCE_MISMATCH"));
});

test("missing scope fails closed",()=>{
  const result=evaluateSenderConstraint({...base,requiredScopes:["commerce:refund"],replayCache:createReplayCache()});
  assert.equal(result.ok,false);
  assert.ok(result.reasonCodes.includes("TOKEN_SCOPE_INSUFFICIENT"));
});

test("expired token fails closed",()=>{
  const result=evaluateSenderConstraint({...base,now:"2026-10-03T06:11:00.000Z",replayCache:createReplayCache()});
  assert.equal(result.ok,false);
  assert.ok(result.reasonCodes.includes("TOKEN_EXPIRED"));
});

test("proof is bound to key method and uri",()=>{
  for(const patch of [
    {proof:{...base.proof,keyThumbprint:"thumb-b"}},
    {method:"DELETE"},
    {uri:"/v1/other"},
  ]){
    assert.equal(evaluateSenderConstraint({...base,...patch,replayCache:createReplayCache()}).ok,false);
  }
});

test("proof replay is rejected",()=>{
  const replayCache=createReplayCache();
  assert.equal(evaluateSenderConstraint({...base,replayCache}).ok,true);
  const second=evaluateSenderConstraint({...base,replayCache});
  assert.equal(second.ok,false);
  assert.ok(second.reasonCodes.includes("PROOF_REPLAY"));
});

test("audit redaction removes sensitive fields",()=>{
  const event=redactSecurityEvent({authorization:"redact",cookie:"redact",actor:"user-1",decision:"DENY"});
  assert.deepEqual(event,{actor:"user-1",decision:"DENY"});
});
