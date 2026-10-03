import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateRevenueOpportunity,
  canActivateCommerce,
  buildRevenuePortfolio,
} from "../hercules-revenue/engine.mjs";

const offer=(overrides={})=>({
  id:"studio-basic",
  name:"Studio Basic",
  model:"subscription",
  priceCents:2900,
  status:"READY",
  evidence:{offerApproved:true,priceApproved:true,fulfillmentReady:true},
  metrics:{qualifiedLeads:20,customers:5,repeatCustomers:2,monthlyRecurringRevenueCents:14500},
  ...overrides,
});

test("opportunity score is evidence-bound and deterministic",()=>{
  const result=evaluateRevenueOpportunity(offer());
  assert.equal(result.score,65);
  assert.deepEqual(result.reasons,["RECURRING_REVENUE","PROVEN_CUSTOMERS","REPEAT_CUSTOMERS","FULFILLMENT_READY"]);
  assert.equal(result.executionAuthority,false);
});

test("missing commercial evidence fails closed",()=>{
  const result=evaluateRevenueOpportunity(offer({evidence:{offerApproved:true,priceApproved:false,fulfillmentReady:true}}));
  assert.equal(result.score,0);
  assert.equal(result.eligible,false);
  assert.deepEqual(result.reasons,["PRICE_NOT_APPROVED"]);
});

test("commerce activation requires provider and operational gates",()=>{
  assert.equal(canActivateCommerce({
    commerceEnabledRequested:true,
    checkoutVerified:true,
    refundVerified:true,
    payoutVerified:true,
    paidOrderTransportVerified:true,
    legalApproved:true,
  }).allowed,true);
});

test("commerce activation reports every missing gate and never self-authorizes",()=>{
  const result=canActivateCommerce({
    commerceEnabledRequested:true,
    checkoutVerified:false,
    refundVerified:true,
    payoutVerified:false,
    paidOrderTransportVerified:false,
    legalApproved:true,
  });
  assert.equal(result.allowed,false);
  assert.equal(result.executionAuthority,false);
  assert.deepEqual(result.blockers,["CHECKOUT_UNVERIFIED","PAYOUT_UNVERIFIED","PAID_ORDER_TRANSPORT_UNVERIFIED"]);
});

test("portfolio prioritizes eligible recurring offers without inventing revenue",()=>{
  const portfolio=buildRevenuePortfolio([
    offer(),
    offer({id:"titan",name:"Titan",model:"one_time",priceCents:4900,metrics:{qualifiedLeads:50,customers:3,repeatCustomers:0,monthlyRecurringRevenueCents:0}}),
  ]);
  assert.equal(portfolio.offers[0].id,"studio-basic");
  assert.equal(portfolio.totals.monthlyRecurringRevenueCents,14500);
  assert.equal(portfolio.executionAuthority,false);
});
