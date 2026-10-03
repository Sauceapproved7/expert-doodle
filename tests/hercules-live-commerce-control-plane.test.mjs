import test from "node:test";
import assert from "node:assert/strict";
import { createLiveSession, transitionLiveSession, pinProduct, issueRealtimeTicket, verifyRealtimeTicket } from "../shopify/hercules/live-commerce/control-plane.mjs";

test("live sessions start as draft and never enable commerce", () => {
  const session=createLiveSession({id:"live-1",shopDomain:"sauceapproved-2.myshopify.com",title:"Friday Drop"});
  assert.equal(session.state,"draft");
  assert.equal(session.commerceEnabled,false);
  assert.equal(session.version,1);
});

test("live session state machine rejects invalid jumps", () => {
  const session=createLiveSession({id:"live-2",shopDomain:"sauceapproved-2.myshopify.com",title:"Drop"});
  assert.throws(()=>transitionLiveSession(session,{from:"draft",to:"live"}),/invalid_live_transition/);
});

test("product pin requires optimistic version and Shopify variant GID", () => {
  const session={...createLiveSession({id:"live-3",shopDomain:"sauceapproved-2.myshopify.com",title:"Drop"}),version:7};
  assert.throws(()=>pinProduct(session,{variantGid:"gid://shopify/ProductVariant/123",expectedVersion:6}),/version_conflict/);
  const pinned=pinProduct(session,{variantGid:"gid://shopify/ProductVariant/123",expectedVersion:7,durationSeconds:300});
  assert.equal(pinned.version,8);
  assert.equal(pinned.pin.variantGid,"gid://shopify/ProductVariant/123");
});

test("realtime tickets are signed, scoped, expiring, and tamper evident", async () => {
  const secret="unit-test-live-ticket-secret";
  const ticket=await issueRealtimeTicket({eventId:"live-4",audience:"viewer",scopes:["live:read","chat:write"],expiresInSeconds:60,secret,now:1000});
  const claims=await verifyRealtimeTicket(ticket,{secret,eventId:"live-4",requiredScope:"chat:write",now:1030});
  assert.equal(claims.eventId,"live-4");
  await assert.rejects(()=>verifyRealtimeTicket(ticket+"x",{secret,eventId:"live-4",requiredScope:"chat:write",now:1030}),/invalid_live_ticket/);
  await assert.rejects(()=>verifyRealtimeTicket(ticket,{secret,eventId:"live-4",requiredScope:"chat:write",now:1061}),/expired_live_ticket/);
});
