import {createMarketing16Manifest, planMarketing16Run} from "./core.mjs";
import {authorizeControlledMarketingExecution} from "./controlled-execution.mjs";
import {dryRunProviderCampaign} from "./provider-dry-run.mjs";
import {simulateProviderPublish} from "./provider-adapter.mjs";

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
    prepareCampaign(input={}) {
      const gate=authorizeControlledMarketingExecution(input.receipt,input.authorization);
      return Object.freeze({...gate,status:"campaign_prepared"});
    },
    providerDryRun(input={}) {
      return dryRunProviderCampaign(input.prepared,input.provider);
    },
    providerPublishSimulation(input={}) {
      return simulateProviderPublish(input.authorization);
    },
    execute(operation,input) {
      if (operation==="health") return this.health();
      if (operation==="manifest") return this.manifest();
      if (operation==="plan") return this.plan(input);
      if (operation==="release") return authorizeRelease(input);
      if (operation==="prepare_campaign") return this.prepareCampaign(input);
      if (operation==="provider_dry_run") return this.providerDryRun(input);
      if (operation==="provider_publish_simulation") return this.providerPublishSimulation(input);
      throw new Error("marketing_operation_not_allowed");
    }
  });
}
