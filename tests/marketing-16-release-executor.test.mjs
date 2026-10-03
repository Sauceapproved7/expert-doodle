import test from "node:test";
import assert from "node:assert/strict";
import {createMarketing16Runtime} from "../sauceapproved-studio/marketing-16/runtime.mjs";

function authorizedRelease(overrides={}) {
  return {
    authorizationId: "owner-release-001",
    brandId: "sauceapproved",
    operation: "shopify_catalog_read",
    evidenceIds: ["catalog-snapshot-001"],
    approved: true,
    ...overrides
  };
}

test("Marketing 16 rejects release execution without explicit authorization", () => {
  const runtime=createMarketing16Runtime();
  assert.throws(
    () => runtime.execute("release", {authorization: authorizedRelease({approved:false})}),
    /marketing_release_not_authorized/
  );
});

test("Marketing 16 admits a bounded read-only Shopify release", () => {
  const runtime=createMarketing16Runtime();
  const result=runtime.execute("release", {authorization: authorizedRelease()});
  assert.equal(result.authorized,true);
  assert.equal(result.operation,"shopify_catalog_read");
  assert.equal(result.publishAllowed,false);
  assert.equal(result.spendAllowed,false);
  assert.equal(result.storefrontMutationAllowed,false);
});

test("Marketing 16 rejects unrecognized release operations", () => {
  const runtime=createMarketing16Runtime();
  assert.throws(
    () => runtime.execute("release", {authorization: authorizedRelease({operation:"shopify_storefront_write"})}),
    /marketing_release_operation_not_allowed/
  );
});
