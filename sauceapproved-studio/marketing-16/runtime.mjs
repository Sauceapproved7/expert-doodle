import {createMarketing16Manifest, planMarketing16Run} from "./core.mjs";

const RELEASE_OPERATIONS = Object.freeze(new Set(["shopify_catalog_read"]));

function authorizeRelease(input={}) {
  const authorization=input?.authorization;
  if (!authorization || authorization.approved !== true) {
    throw new Error("marketing_release_not_authorized");
  }
  const authorizationId=String(authorization.authorizationId||"").trim();
  const brandId=String(authorization.brandId||"").trim();
  const operation=String(authorization.operation||"").trim();
  const evidenceIds=Array.isArray(authorization.evidenceIds)
    ? [...new Set(authorization.evidenceIds.map(String).map(x=>x.trim()).filter(Boolean))]
    : [];
  if (!authorizationId || !brandId || !evidenceIds.length) {
    throw new Error("marketing_release_not_authorized");
  }
  if (!RELEASE_OPERATIONS.has(operation)) {
    throw new Error("marketing_release_operation_not_allowed");
  }
  return Object.freeze({
    authorized:true,
    authorizationId,
    brandId,
    operation,
    evidenceIds,
    publishAllowed:false,
    spendAllowed:false,
    storefrontMutationAllowed:false
  });
}

export function createMarketing16Runtime() {
  const manifest=createMarketing16Manifest();
  return Object.freeze({
    health() {
      return {
        ok:true,
        service:"hercules-marketing-16",
        version:"1",
        modules:manifest.modules.length,
        executionPolicy:manifest.executionPolicy,
        autoPublish:manifest.autoPublish,
        autoSpend:manifest.autoSpend,
        storefrontMutation:manifest.storefrontMutation
      };
    },
    manifest() {
      return structuredClone(manifest);
    },
    plan(input) {
      return planMarketing16Run(input);
    },
    execute(operation,input) {
      if (operation==="health") return this.health();
      if (operation==="manifest") return this.manifest();
      if (operation==="plan") return this.plan(input);
      if (operation==="release") return authorizeRelease(input);
      throw new Error("marketing_operation_not_allowed");
    }
  });
}
