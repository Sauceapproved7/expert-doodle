import assert from "node:assert/strict";
import test from "node:test";
import {
  MARKETPLACE_CATALOG,
  createMarketplaceCatalog,
  findMarketplaceApps,
  getMarketplaceApp
} from "../sauceapproved-marketplace/catalog.mjs";
import {createMarketplaceInstallPlan} from "../sauceapproved-marketplace/install-plan.mjs";

test("marketplace catalog is owner-code, uniquely identified, and does not hardcode unapproved launch prices",()=>{
  const catalog=createMarketplaceCatalog({audience:"owner"});
  assert.equal(catalog.schema,"sauceapproved.marketplace.catalog");
  assert.equal(catalog.version,1);
  assert.equal(catalog.owner,"SauceApproved");
  const ids=catalog.apps.map(app=>app.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.ok(ids.includes("hercules"));
  assert.ok(ids.includes("sauceapproved-studio"));
  assert.ok(ids.includes("freshtrack-ai"));
  assert.ok(ids.includes("sauceapproved-forge"));
  for(const app of catalog.apps){
    assert.equal(app.ownedCode,true);
    assert.equal("priceCents" in app,false);
    assert.equal("secret" in app,false);
    assert.equal("credential" in app,false);
  }
});

test("public marketplace excludes internal control-plane products",()=>{
  const publicCatalog=createMarketplaceCatalog({audience:"public"});
  const ids=publicCatalog.apps.map(app=>app.id);
  assert.ok(ids.includes("hercules"));
  assert.ok(ids.includes("sauceapproved-studio"));
  assert.ok(ids.includes("freshtrack-ai"));
  assert.equal(ids.includes("sauceapproved-forge"),false);
  assert.equal(ids.includes("sauceapproved-ops-hub"),false);
  assert.ok(publicCatalog.apps.every(app=>app.visibility==="public"));
});

test("owner catalog retains internal products without exposing privileged endpoints",()=>{
  const ownerCatalog=createMarketplaceCatalog({audience:"owner"});
  const forge=ownerCatalog.apps.find(app=>app.id==="sauceapproved-forge");
  assert.equal(forge?.visibility,"internal");
  assert.equal(forge?.distribution,"owner-only");
  assert.equal("adminUrl" in forge,false);
  assert.equal("internalEndpoint" in forge,false);
});

test("marketplace search is deterministic and audience-aware",()=>{
  const hits=findMarketplaceApps("video creative",{audience:"public"});
  assert.deepEqual(hits.map(app=>app.id),["sauceapproved-studio"]);
  const internalHits=findMarketplaceApps("forge build",{audience:"public"});
  assert.deepEqual(internalHits,[]);
  assert.equal(getMarketplaceApp("sauceapproved-forge",{audience:"public"}),null);
  assert.equal(getMarketplaceApp("sauceapproved-forge",{audience:"owner"})?.id,"sauceapproved-forge");
});

test("Hercules install planning stays held until controlled pilot authorization or public release",()=>{
  const held=createMarketplaceInstallPlan({
    appId:"hercules",
    audience:"public",
    commercialReady:false,
    publicRegistrationOpen:false,
    pilotAuthorized:false
  });
  assert.equal(held.allowed,false);
  assert.equal(held.reason,"controlled_pilot_authorization_required");
  assert.equal(held.sideEffects,false);

  const pilot=createMarketplaceInstallPlan({
    appId:"hercules",
    audience:"public",
    commercialReady:false,
    publicRegistrationOpen:false,
    pilotAuthorized:true
  });
  assert.equal(pilot.allowed,true);
  assert.equal(pilot.mode,"controlled-pilot");
  assert.equal(pilot.sideEffects,false);
});

test("public paid installation cannot unlock from catalog state alone",()=>{
  const held=createMarketplaceInstallPlan({
    appId:"hercules",
    audience:"public",
    commercialReady:false,
    publicRegistrationOpen:true,
    pilotAuthorized:false
  });
  assert.equal(held.allowed,false);
  assert.notEqual(held.reason,null);

  const publicRelease=createMarketplaceInstallPlan({
    appId:"hercules",
    audience:"public",
    commercialReady:true,
    publicRegistrationOpen:true,
    pilotAuthorized:false
  });
  assert.equal(publicRelease.allowed,true);
  assert.equal(publicRelease.mode,"public-release");
  assert.equal(publicRelease.sideEffects,false);
});

test("prelaunch apps produce preview plans, never synthetic install success",()=>{
  for(const appId of ["sauceapproved-studio","freshtrack-ai"]){
    const plan=createMarketplaceInstallPlan({
      appId,
      audience:"public",
      commercialReady:false,
      publicRegistrationOpen:false,
      pilotAuthorized:false
    });
    assert.equal(plan.allowed,true);
    assert.equal(plan.mode,"preview");
    assert.equal(plan.sideEffects,false);
    assert.equal(plan.requiresExecutionHandoff,true);
  }
});

test("internal apps are owner-only regardless of public launch state",()=>{
  const plan=createMarketplaceInstallPlan({
    appId:"sauceapproved-forge",
    audience:"public",
    commercialReady:true,
    publicRegistrationOpen:true,
    pilotAuthorized:true
  });
  assert.equal(plan.allowed,false);
  assert.equal(plan.reason,"owner_only_product");
});

test("catalog source itself is immutable to consumers",()=>{
  assert.equal(Object.isFrozen(MARKETPLACE_CATALOG),true);
  assert.equal(Object.isFrozen(MARKETPLACE_CATALOG.apps),true);
});
