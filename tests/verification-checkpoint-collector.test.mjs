import test from "node:test";
import assert from "node:assert/strict";
import {
  collectVerificationCheckpoints,
  routeVerificationSnapshot
} from "../hercules-runtime/verification-checkpoint-collector.mjs";

const provenance=(source,suffix)=>({source,fingerprint:`sha256:${suffix}`});

test("collector converts authorized provider state into bounded auto-resume checkpoints",()=>{
  const checkpoints=collectVerificationCheckpoints({
    shopify:{
      readAuthorized:true,
      evidenceFresh:true,
      provenance:provenance("shopify-admin","shopify123")
    },
    spaceship:{
      status:"configured",
      evidenceFresh:true,
      provenance:provenance("spaceship-oauth","spaceship123")
    }
  });

  assert.deepEqual(
    checkpoints.filter(x=>x.authorized&&!x.ownerOnly).map(x=>[x.id,x.requestedAction]),
    [
      ["DA-20","reconcile_dns_cutover"],
      ["DA-42","observe_and_reconcile_verified_paid_orders"]
    ]
  );
});

test("live Stripe without complete checkout refund and payout proof remains owner-only",()=>{
  const routed=routeVerificationSnapshot({
    stripe:{
      liveAuthorized:true,
      providerReady:true,
      evidenceFresh:true,
      provenance:provenance("stripe-live","stripe123"),
      paymentProof:{checkout:false,refund:false,payout:false}
    }
  });

  assert.deepEqual(routed.autoResume,[]);
  assert.ok(routed.ownerActions.includes("DA-27"));
});

test("native Supabase leaked-password protection clearing can auto-resume auth reconciliation",()=>{
  const routed=routeVerificationSnapshot({
    supabase:{
      nativeLeakedPasswordProtection:true,
      evidenceFresh:true,
      provenance:provenance("supabase-security-advisor","supabase123")
    }
  });

  assert.ok(routed.autoResume.some(x=>
    x.id==="DA-19"&&x.action==="reconcile_auth_hardening"
  ));
});

test("pending Spaceship authorization is surfaced as owner action and never DNS mutation",()=>{
  const routed=routeVerificationSnapshot({
    spaceship:{
      status:"pending_authorization",
      evidenceFresh:true,
      provenance:provenance("spaceship-oauth","spaceship456")
    }
  });

  assert.deepEqual(routed.autoResume,[]);
  assert.ok(routed.ownerActions.includes("DA-20"));
});

test("Founding Access never auto-publishes even when all prerequisite evidence is green",()=>{
  const routed=routeVerificationSnapshot({
    titan:{
      commercialApprovalsComplete:true,
      paymentPathVerified:true,
      paidOrderEntitlementProof:true,
      evidenceFresh:true,
      provenance:provenance("launch-gate","titan123")
    }
  });

  assert.deepEqual(routed.autoResume,[]);
  assert.ok(routed.ownerActions.includes("DA-34"));
  const checkpoint=routed.checkpoints.find(x=>x.id==="DA-34");
  assert.equal(checkpoint.decision,"owner_action");
});

test("stale or incomplete provider snapshots fail closed",()=>{
  const routed=routeVerificationSnapshot({
    shopify:{
      readAuthorized:true,
      evidenceFresh:false,
      provenance:provenance("shopify-admin","stale123")
    },
    supabase:{
      nativeLeakedPasswordProtection:false,
      evidenceFresh:true,
      provenance:null
    }
  });

  assert.deepEqual(routed.autoResume,[]);
  assert.equal(routed.holds.length,2);
});
