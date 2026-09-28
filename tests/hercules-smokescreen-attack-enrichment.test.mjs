import test from "node:test";
import assert from "node:assert/strict";
import {createAttackEnrichment} from "../hercules-runtime/smokescreen-attack-enrichment.mjs";
import {createSmokeScreenAgent} from "../hercules-runtime/smokescreen-agent.mjs";
import {createForgeSmokeScreenObserver} from "../hercules-runtime/smokescreen-forge-ingress.mjs";

const key="0123456789abcdef0123456789abcdef";

function ids(enrichment){
  return enrichment.techniques.map((item)=>item.id);
}

test("credential stuffing maps directly to ATT&CK T1110.004 without claiming Valid Accounts",()=>{
  const enrichment=createAttackEnrichment({
    route:"/login",
    signals:{
      authFailures:20,
      credentialStuffing:true,
    },
  });

  assert.ok(ids(enrichment).includes("T1110.004"));
  assert.equal(ids(enrichment).includes("T1078"),false);
  const stuffing=enrichment.techniques.find((item)=>item.id==="T1110.004");
  assert.equal(stuffing.name,"Credential Stuffing");
  assert.equal(stuffing.tactic,"Credential Access");
  assert.equal(stuffing.confidence,"HIGH");
  assert.equal(stuffing.basis,"DIRECT_SIGNAL");
  assert.equal(stuffing.needsCorroboration,false);
  assert.equal(enrichment.actorAttribution,false);
  assert.equal(enrichment.campaignAttribution,false);
  assert.equal(enrichment.automaticResponseAuthority,false);
  assert.equal(enrichment.outboundCounterattack,false);
});

test("route enumeration maps to T1595.003 and refuses unsupported network-service inference",()=>{
  const enrichment=createAttackEnrichment({
    route:"/admin/does-not-exist",
    signals:{
      routeProbes:12,
      enumerationPattern:true,
      requestVelocity:40,
    },
  });

  assert.ok(ids(enrichment).includes("T1595.003"));
  assert.equal(ids(enrichment).includes("T1046"),false);
  const scanning=enrichment.techniques.find((item)=>item.id==="T1595.003");
  assert.equal(scanning.name,"Wordlist Scanning");
  assert.equal(scanning.tactic,"Reconnaissance");
  assert.equal(scanning.confidence,"HIGH");
});

test("identity-route enumeration can add Account Discovery as a corroborated candidate",()=>{
  const enrichment=createAttackEnrichment({
    route:"/v1/users",
    signals:{
      routeProbes:10,
      enumerationPattern:true,
    },
  });

  assert.ok(ids(enrichment).includes("T1595.003"));
  assert.ok(ids(enrichment).includes("T1087"));
  const accountDiscovery=enrichment.techniques.find((item)=>item.id==="T1087");
  assert.equal(accountDiscovery.confidence,"MEDIUM");
  assert.equal(accountDiscovery.needsCorroboration,true);
  assert.equal(enrichment.routeCategory,"identity");
});

test("repeated authentication failures map to password guessing only when credential stuffing is absent",()=>{
  const enrichment=createAttackEnrichment({
    route:"/login",
    signals:{authFailures:7},
  });
  assert.ok(ids(enrichment).includes("T1110.001"));
  assert.equal(ids(enrichment).includes("T1110.004"),false);
});

test("boundary plus integrity anomalies can only produce a low-confidence T1190 candidate",()=>{
  const enrichment=createAttackEnrichment({
    route:"/admin/export",
    signals:{
      signatureMismatches:3,
      privilegeBoundaryProbe:true,
    },
  });
  const exploit=enrichment.techniques.find((item)=>item.id==="T1190");
  assert.ok(exploit);
  assert.equal(exploit.confidence,"LOW");
  assert.equal(exploit.needsCorroboration,true);
  assert.equal(exploit.basis,"HEURISTIC");
});

test("benign telemetry does not invent ATT&CK techniques",()=>{
  const enrichment=createAttackEnrichment({
    route:"/health",
    signals:{requestVelocity:2},
  });
  assert.deepEqual(enrichment.techniques,[]);
  assert.equal(enrichment.routeCategory,"generic");
});

test("ATT&CK enrichment never exposes the raw route",()=>{
  const rawRoute="/admin/private-secret-customer-name";
  const enrichment=createAttackEnrichment({
    route:rawRoute,
    signals:{routeProbes:9,enumerationPattern:true},
  });
  assert.equal(JSON.stringify(enrichment).includes(rawRoute),false);
});

test("Forge observe-only ingress emits ATT&CK enrichment without gaining enforcement authority",async()=>{
  const agent=createSmokeScreenAgent({hmacKey:key,now:()=>1_790_000_000_000});
  const observer=createForgeSmokeScreenObserver({
    agent,
    mode:"OBSERVE_ONLY",
    now:()=>1_790_000_000_000,
  });

  let result;
  for(let index=0;index<12;index+=1){
    result=await observer.observe({
      method:"POST",
      pathname:"/login",
      statusCode:401,
      remoteAddress:"203.0.113.90",
      userAgent:"synthetic-attack-enrichment-test",
      hasAuthorizationHeader:false,
    });
  }

  assert.equal(result.mode,"OBSERVE_ONLY");
  assert.equal(result.enforcementApplied,false);
  assert.ok(ids(result.attackEnrichment).includes("T1110.004"));
  assert.equal(result.attackEnrichment.automaticResponseAuthority,false);
  assert.equal(result.attackEnrichment.outboundCounterattack,false);
});
