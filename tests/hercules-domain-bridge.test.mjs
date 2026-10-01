import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStudioDnsPlan,
  buildSpaceshipUpsertRequest,
  validateStudioDnsPlan
} from "../hercules-domain-bridge/spaceship-dns.mjs";

test("builds a non-destructive plan for the Studio subdomain", () => {
  const plan = buildStudioDnsPlan({
    domain: "sauceapproved.com",
    studioHost: "studio",
    target: "sauceapproved-studio.onrender.com",
    existingRecords: [
      { type: "MX", name: "@", address: "mail.example.test", ttl: 3600 },
      { type: "TXT", name: "@", address: "keep-me", ttl: 3600 }
    ]
  });

  assert.equal(plan.action, "upsert");
  assert.deepEqual(plan.changes, [{
    type: "CNAME",
    name: "studio",
    address: "sauceapproved-studio.onrender.com",
    ttl: 3600
  }]);
  assert.equal(plan.destructive, false);
});

test("rejects a plan that would replace apex records", () => {
  assert.throws(
    () => validateStudioDnsPlan({
      domain: "sauceapproved.com",
      changes: [{ type: "A", name: "@", address: "1.2.3.4", ttl: 3600 }]
    }),
    /apex|destructive/i
  );
});

test("requires the exact owned domain", () => {
  assert.throws(
    () => buildStudioDnsPlan({
      domain: "example.com",
      studioHost: "studio",
      target: "sauceapproved-studio.onrender.com",
      existingRecords: []
    }),
    /sauceapproved\.com/
  );
});

test("builds the exact Spaceship DNS write request without force", () => {
  const request = buildSpaceshipUpsertRequest({
    domain: "sauceapproved.com",
    changes: [{
      type: "CNAME",
      name: "studio",
      address: "sauceapproved-studio.onrender.com",
      ttl: 3600
    }]
  });

  assert.deepEqual(request, {
    method: "PUT",
    path: "/api/v1/dns/records/sauceapproved.com",
    body: {
      force: false,
      items: [{
        type: "CNAME",
        name: "studio",
        address: "sauceapproved-studio.onrender.com",
        ttl: 3600
      }]
    }
  });
});

test("rejects forced DNS writes", () => {
  assert.throws(
    () => buildSpaceshipUpsertRequest({
      domain: "sauceapproved.com",
      force: true,
      changes: [{
        type: "CNAME",
        name: "studio",
        address: "sauceapproved-studio.onrender.com",
        ttl: 3600
      }]
    }),
    /force/i
  );
});
