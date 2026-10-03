import test from "node:test";
import assert from "node:assert/strict";
import {evidenceToLaunchInput} from "../hercules-runtime/hercules-launch-evidence-adapter.mjs";

test("maps only explicit verified evidence into launch-finisher inputs",()=>{
  const input=evidenceToLaunchInput({
    shopify:{transportAuthorized:true,paidOrderObserved:true},
    refund:{verified:true},
    payout:{verified:true}
  });
  assert.deepEqual(input,{transportAuthorized:true,paidOrderObserved:true,refundVerified:true,payoutVerified:true,zeroOwnerSpend:true});
});

test("missing, pending, or unverified evidence fails closed",()=>{
  const input=evidenceToLaunchInput({
    shopify:{transportAuthorized:true,paidOrderObserved:false},
    refund:{verified:false},
    payout:{status:"pending_owner_auth"}
  });
  assert.deepEqual(input,{transportAuthorized:true,paidOrderObserved:false,refundVerified:false,payoutVerified:false,zeroOwnerSpend:true});
});

test("truthy strings cannot forge verified evidence",()=>{
  const input=evidenceToLaunchInput({
    shopify:{transportAuthorized:"true",paidOrderObserved:"true"},
    refund:{verified:"true"},
    payout:{verified:"true"}
  });
  assert.deepEqual(input,{transportAuthorized:false,paidOrderObserved:false,refundVerified:false,payoutVerified:false,zeroOwnerSpend:true});
});
