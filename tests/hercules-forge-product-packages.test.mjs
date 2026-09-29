import assert from "node:assert/strict";
import test from "node:test";
import {
  listForgeProductPackages,
  getForgeProductPackage,
  buildForgeProductPrompt,
} from "../hercules-forge/product-packages.mjs";
import {builderConsoleHtml, builderConsoleJs} from "../hercules-forge/builder-console.mjs";

test("Forge exposes the owned sellable product packages", () => {
  const packages = listForgeProductPackages();
  assert.deepEqual(packages.map(item => item.id), [
    "sauceapproved-studio",
    "sauceapproved-ads",
    "hercules-cleaner",
  ]);
  assert.equal(packages[0].publicName, "SauceApproved Studio");
  assert.equal(packages[0].descriptor, "AI Video Maker");
  assert.equal(packages[1].publicName, "SauceApproved Ads");
  assert.equal(packages[1].descriptor, "AI Ad Maker");
  assert.equal(packages[2].publicName, "Hercules Cleaner");
  assert.equal(packages[2].descriptor, "Recoverable Computer Maintenance");
});

test("product packages point at owned canonical product cores", () => {
  const studio = getForgeProductPackage("sauceapproved-studio");
  const ads = getForgeProductPackage("sauceapproved-ads");
  const cleaner = getForgeProductPackage("hercules-cleaner");
  assert.ok(studio.sourceRoots.includes("hercules-video/"));
  assert.ok(ads.sourceRoots.includes("hercules-forge/ad-studio/index.html"));
  assert.ok(cleaner.sourceRoots.includes("hercules-cleaner/"));
  assert.ok(cleaner.sourceRoots.includes("HerculesCleaner-Setup.cmd"));
  assert.ok(cleaner.sourceRoots.includes("releases/hercules-cleaner-v1.1.0/"));
  assert.equal(studio.ownership.core, "SauceApproved-owned");
  assert.equal(ads.ownership.core, "SauceApproved-owned");
  assert.equal(cleaner.ownership.core, "SauceApproved-owned");
  assert.equal(studio.ownership.externalInfrastructureClaimedAsOwned, false);
  assert.equal(ads.ownership.externalInfrastructureClaimedAsOwned, false);
  assert.equal(cleaner.ownership.externalInfrastructureClaimedAsOwned, false);
});

test("candidate pricing is packaged but checkout stays fail-closed pending owner approvals", () => {
  for (const item of listForgeProductPackages()) {
    assert.equal(item.pricing.status, "owner_approval_required");
    assert.deepEqual(item.pricing.candidateMonthlyUsd, {
      starter: 29,
      pro: 79,
      agency: 199,
    });
    assert.equal(item.commerce.checkoutEnabled, false);
    assert.deepEqual(item.commerce.requiredBeforeCheckout, [
      "pricing_approval",
      "terms_approval",
      "privacy_approval",
      "payment_provider_ready",
      "paid_checkout_verified",
    ]);
  }
});

test("product packages cannot require AppDeploy for build or release", () => {
  for (const item of listForgeProductPackages()) {
    assert.deepEqual(item.deployment, {
      controlPlane: "hercules-forge-builder",
      releaseRuntime: "hercules-deploy",
      archiveRuntime: "supabase",
      presentationRuntime: "render",
      appDeployRequired: false,
      providerCreditsMayBlockRelease: false,
    });
  }
});

test("Forge package prompts preserve product cores and require SaaS packaging gates", () => {
  const prompt = buildForgeProductPrompt("sauceapproved-studio");
  assert.match(prompt, /SauceApproved Studio/);
  assert.match(prompt, /AI Video Maker/);
  assert.match(prompt, /hercules-video\//);
  assert.match(prompt, /preserve the existing owned product core/i);
  assert.match(prompt, /authentication/i);
  assert.match(prompt, /plan entitlements/i);
  assert.match(prompt, /billing/i);
  assert.match(prompt, /checkout disabled/i);
  assert.match(prompt, /owner approval/i);
  assert.match(prompt, /do not replace the owned core with a hosted builder/i);
  assert.match(prompt, /AppDeploy is not required/i);
  assert.match(prompt, /Hercules Forge Builder.*Hercules Deploy/i);
  assert.match(prompt, /Supabase.*Render/i);
});

test("builder console exposes first-class quick starts for both product packages", () => {
  const html = builderConsoleHtml();
  const js = builderConsoleJs();
  assert.match(html, /Product packages/);
  assert.match(html, /SauceApproved Studio/);
  assert.match(html, /SauceApproved Ads/);
  assert.match(html, /Hercules Cleaner/);
  assert.match(js, /sauceapproved-studio/);
  assert.match(js, /sauceapproved-ads/);
  assert.match(js, /hercules-cleaner/);
  assert.match(js, /buildForgePackagePrompt/);
});
