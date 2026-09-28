import test from "node:test";
import assert from "node:assert/strict";
import {
  createObserveOnlyIngressAdapter,
  deriveObserveSignals,
} from "../hercules-runtime/smokescreen-ingress-observer.mjs";

const key="observe-only-test-key-000000000000000000000000";

test("observe ingress scores traffic but never changes routing",()=>{
  const adapter=createObserveOnlyIngressAdapter({hmacKey:key,now:()=>1_790_100_000_000});
  const request={
    method:"GET",
    url:"/admin/export?probe=1",
    headers:{"user-agent":"scanner-test","x-forwarded-for":"203.0.113.8"},
    context:{failedAuthAttempts:9,routeProbes:30,enumerationPattern:true,privilegeBoundaryProbe:true},
  };
  const result=adapter.observe(request);
  assert.equal(result.mode,"OBSERVE_ONLY");
  assert.equal(result.enforcementEnabled,false);
  assert.equal(result.routeMutationAllowed,false);
  assert.equal(result.blockingAllowed,false);
  assert.equal(result.delayAllowed,false);
  assert.equal(result.originalRoute,"/admin/export");
  assert.ok(["MONITOR","FRICTION","DECOY"].includes(result.decision.routeMode));
});

test("observer strips query strings and never records authorization or cookie values",()=>{
  const adapter=createObserveOnlyIngressAdapter({hmacKey:key,now:()=>1_790_100_000_000});
  const result=adapter.observe({
    method:"POST",
    url:"/v1/run?token=secret-value",
    headers:{
      authorization:"Bearer do-not-log",
      cookie:"session=do-not-log",
      "user-agent":"browser",
      "x-forwarded-for":"198.51.100.7",
    },
    context:{},
  });
  const serialized=JSON.stringify(result);
  assert.equal(result.originalRoute,"/v1/run");
  assert.equal(serialized.includes("secret-value"),false);
  assert.equal(serialized.includes("do-not-log"),false);
  assert.equal(serialized.includes("authorization"),false);
  assert.equal(serialized.includes("cookie"),false);
});

test("raw client IP is reduced to a keyed pseudonymous fingerprint",()=>{
  const signals=deriveObserveSignals({
    method:"GET",
    url:"/",
    headers:{"x-forwarded-for":"203.0.113.99"},
    context:{},
  },{hmacKey:key});
  assert.equal("clientIp" in signals,false);
  assert.match(signals.clientFingerprint,/^[a-f0-9]{24}$/);
  assert.equal(JSON.stringify(signals).includes("203.0.113.99"),false);
});

test("untrusted headers cannot self-assert hostile security signals",()=>{
  const signals=deriveObserveSignals({
    method:"GET",
    url:"/",
    headers:{
      "x-hercules-honeytoken-touched":"true",
      "x-hercules-known-malicious":"true",
    },
    context:{},
  },{hmacKey:key});
  assert.equal(signals.honeytokenTouched,false);
  assert.equal(signals.knownMaliciousIndicator,false);
});

test("trusted server context can supply bounded security signals",()=>{
  const signals=deriveObserveSignals({
    method:"POST",
    url:"/v1/auth/login",
    headers:{},
    context:{
      failedAuthAttempts:999,
      routeProbes:9999,
      requestBurst:99999,
      enumerationPattern:true,
      privilegeBoundaryProbe:true,
      honeytokenTouched:true,
      knownMaliciousIndicator:true,
    },
  },{hmacKey:key});
  assert.equal(signals.failedAuthAttempts,50);
  assert.equal(signals.routeProbes,100);
  assert.equal(signals.requestBurst,1000);
  assert.equal(signals.enumerationPattern,true);
  assert.equal(signals.privilegeBoundaryProbe,true);
  assert.equal(signals.honeytokenTouched,true);
  assert.equal(signals.knownMaliciousIndicator,true);
});
