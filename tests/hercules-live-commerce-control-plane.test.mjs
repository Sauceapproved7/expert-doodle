import test from "node:test";
import assert from "node:assert/strict";
import {
  createLiveSession,
  transitionLiveSession,
  pinProduct,
  issueRealtimeTicket,
  verifyRealtimeTicket
} from "../shopify/hercules/live-commerce/control-plane.mjs";

const secret = "unit-test-live-ticket-secret-with-32-bytes";

test("live sessions start as draft and never enable commerce", () => {
  const session = createLiveSession({ id: "live-1", shopDomain: "sauceapproved-2.myshopify.com", title: "Friday Drop" });
  assert.equal(session.state, "draft");
  assert.equal(session.commerceEnabled, false);
  assert.equal(session.version, 1);
});

test("live session state machine rejects invalid jumps and malformed versions", () => {
  const session = createLiveSession({ id: "live-2", shopDomain: "sauceapproved-2.myshopify.com", title: "Drop" });
  assert.throws(() => transitionLiveSession(session, { from: "draft", to: "live" }), /invalid_live_transition/);
  assert.throws(() => transitionLiveSession({ ...session, version: NaN }, { from: "draft", to: "scheduled" }), /invalid_live_version/);
  assert.throws(() => transitionLiveSession({ ...session, version: Number.MAX_SAFE_INTEGER }, { from: "draft", to: "scheduled" }), /live_version_exhausted/);
});

test("product pin requires optimistic version, valid Shopify GID, and a nonterminal session", () => {
  const session = { ...createLiveSession({ id: "live-3", shopDomain: "sauceapproved-2.myshopify.com", title: "Drop" }), version: 7 };
  assert.throws(() => pinProduct(session, { variantGid: "gid://shopify/ProductVariant/123", expectedVersion: 6 }), /version_conflict/);
  const pinned = pinProduct(session, { variantGid: "gid://shopify/ProductVariant/123", expectedVersion: 7, durationSeconds: 300 });
  assert.equal(pinned.version, 8);
  assert.equal(pinned.pin.variantGid, "gid://shopify/ProductVariant/123");
  assert.equal(pinned.commerceEnabled, false);
  assert.throws(() => pinProduct({ ...session, state: "ended" }, { variantGid: "gid://shopify/ProductVariant/123", expectedVersion: 7 }), /live_session_not_pinnable/);
});

test("realtime tickets are signed, scoped, expiring, audience-bound, and tamper evident", async () => {
  const ticket = await issueRealtimeTicket({ eventId: "live-4", audience: "viewer", scopes: ["live:read", "chat:write"], expiresInSeconds: 60, secret, now: 1000 });
  const claims = await verifyRealtimeTicket(ticket, { secret, eventId: "live-4", expectedAudience: "viewer", requiredScope: "chat:write", now: 1030 });
  assert.equal(claims.eventId, "live-4");
  assert.equal(claims.audience, "viewer");
  await assert.rejects(() => verifyRealtimeTicket(ticket, { secret, eventId: "live-4", expectedAudience: "moderator", now: 1030 }), /live_ticket_audience_mismatch/);
  await assert.rejects(() => verifyRealtimeTicket(ticket, { secret, eventId: "live-4", now: 1030 }), /live_ticket_audience_required/);
  await assert.rejects(() => verifyRealtimeTicket(ticket, { secret, eventId: "live-4", expectedAudience: "viewer", requiredScope: "admin:write", now: 1030 }), /live_ticket_scope_denied/);
  await assert.rejects(() => verifyRealtimeTicket(ticket + "x", { secret, eventId: "live-4", expectedAudience: "viewer", requiredScope: "chat:write", now: 1030 }), /invalid_live_ticket/);
  await assert.rejects(() => verifyRealtimeTicket(ticket, { secret, eventId: "live-4", expectedAudience: "viewer", requiredScope: "chat:write", now: 1060 }), /expired_live_ticket/);
});

test("realtime ticket issuance validates secret, scopes, and bounded lifetime", async () => {
  await assert.rejects(() => issueRealtimeTicket({ eventId: "live-5", audience: "viewer", secret: "short", now: 1000 }), /live_ticket_secret_too_short/);
  await assert.rejects(() => issueRealtimeTicket({ eventId: "live-5", audience: "viewer", scopes: "chat:read", secret, now: 1000 }), /invalid_live_ticket_scopes/);
  await assert.rejects(() => issueRealtimeTicket({ eventId: "live-5", audience: "viewer", secret, expiresInSeconds: 901, now: 1000 }), /invalid_live_ticket_ttl/);
});
