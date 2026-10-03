import test from "node:test";
import assert from "node:assert/strict";
import {buildDomainControlCenter} from "../supabase/functions/hercules-domains/domain-controller.mjs";

test("control center reports a fail-closed deployment gate until DNS, Shopify attachment, and SSL are ready",()=>{
  const result=buildDomainControlCenter({
    launch:{readiness:{registrarReady:true,dnsReady:true,sslKnownGood:false},blockers:[]},
    shopifyCutover:{intended_domain_present:false,intended_domain_ssl_enabled:false,stage:"waiting_domain"},
    launchReadiness:{stage:"waiting_domain",gates:{}},
    https:{reachable:true,status:200,location:null},
  });
  assert.equal(result.deploymentGate.open,false);
  assert.deepEqual(result.deploymentGate.blockers,["shopify_domain_not_attached","shopify_ssl_not_enabled"]);
});

test("control center opens deployment gate only when DNS, Shopify attachment, and SSL are all ready",()=>{
  const result=buildDomainControlCenter({
    launch:{readiness:{registrarReady:true,dnsReady:true,sslKnownGood:true},blockers:[]},
    shopifyCutover:{intended_domain_present:true,intended_domain_ssl_enabled:true,stage:"ready"},
    launchReadiness:{stage:"ready",gates:{}},
    https:{reachable:true,status:200,location:null},
  });
  assert.equal(result.deploymentGate.open,true);
  assert.deepEqual(result.deploymentGate.blockers,[]);
});

test("control center exposes component states without secrets or mutation authority",()=>{
  const result=buildDomainControlCenter({
    launch:{readiness:{registrarReady:false,dnsReady:false,sslKnownGood:false},blockers:["spaceship_credentials_unconfigured"]},
    shopifyCutover:null,launchReadiness:null,https:{reachable:false,status:null,location:null},
  });
  assert.equal(result.components.dns.status,"blocked");
  assert.equal(result.components.ssl.status,"blocked");
  assert.equal(result.capabilities.mutation,false);
  assert.equal(result.capabilities.readOnly,true);
  assert.equal(JSON.stringify(result).includes("secret"),false);
});
