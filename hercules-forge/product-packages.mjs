export const FORGE_PRODUCT_PACKAGE_VERSION = "1.1";

const COMMON_PRICING = Object.freeze({
  status: "owner_approval_required",
  currency: "USD",
  interval: "month",
  candidateMonthlyUsd: Object.freeze({
    starter: 29,
    pro: 79,
    agency: 199,
  }),
});

const COMMON_COMMERCE = Object.freeze({
  checkoutEnabled: false,
  requiredBeforeCheckout: Object.freeze([
    "pricing_approval",
    "terms_approval",
    "privacy_approval",
    "payment_provider_ready",
    "paid_checkout_verified",
  ]),
});

const COMMON_OWNERSHIP = Object.freeze({
  core: "SauceApproved-owned",
  externalInfrastructureClaimedAsOwned: false,
  rule: "Preserve the SauceApproved-owned product core and keep replaceable infrastructure behind explicit adapters.",
});

const COMMON_DEPLOYMENT = Object.freeze({
  controlPlane: "hercules-forge-builder",
  releaseRuntime: "hercules-deploy",
  archiveRuntime: "supabase",
  presentationRuntime: "render",
  appDeployRequired: false,
  providerCreditsMayBlockRelease: false,
});

const PACKAGES = Object.freeze([
  Object.freeze({
    version: FORGE_PRODUCT_PACKAGE_VERSION,
    id: "sauceapproved-studio",
    publicName: "SauceApproved Studio",
    descriptor: "AI Video Maker",
    projectId: "sauceapproved-studio",
    sourceRoots: Object.freeze([
      "hercules-video/",
      "docs/HERCULES-VIDEO-V0.1.md",
      "docs/HERCULES-VIDEO-V1.0-LOCAL-LAUNCH-BOOTSTRAP.md",
      "docs/HERCULES-VIDEO-V1.1-RENDER-QUALITY-GATE.md",
      "docs/HERCULES-VIDEO-V1.2-ENFORCED-QUALITY-GATE.md",
      "docs/HERCULES-VIDEO-V1.3-LAUNCH-EVIDENCE-INTEGRITY.md",
      "docs/HERCULES-VIDEO-V1.4-PERSISTENT-LAUNCH-RESUME.md",
      "docs/HERCULES-VIDEO-V1.5-RUN-STATUS.md",
    ]),
    ownership: COMMON_OWNERSHIP,
    deployment: COMMON_DEPLOYMENT,
    pricing: COMMON_PRICING,
    commerce: COMMON_COMMERCE,
    plans: Object.freeze({
      starter: Object.freeze({
        label: "Starter",
        audience: "Solo creators",
        entitlements: Object.freeze([
          "video_projects",
          "storyboard_generation",
          "quality_gated_exports",
          "provenance_manifest",
        ]),
      }),
      pro: Object.freeze({
        label: "Pro",
        audience: "Growing brands and creators",
        entitlements: Object.freeze([
          "starter_features",
          "campaign_workspaces",
          "multi_scene_assembly",
          "brand_presets",
          "priority_render_queue_policy",
        ]),
      }),
      agency: Object.freeze({
        label: "Agency",
        audience: "Teams and client-service operators",
        entitlements: Object.freeze([
          "pro_features",
          "multi_brand_workspaces",
          "team_roles",
          "client_export_packages",
          "higher_usage_policy",
        ]),
      }),
    }),
    packagingGoals: Object.freeze([
      "public SaaS landing and pricing experience",
      "authentication and protected customer workspace",
      "server-side plan entitlements and usage metering hooks",
      "billing adapter with verified webhook-driven subscription state",
      "customer billing and subscription status surface",
      "terms and privacy surfaces requiring owner approval before activation",
      "mobile, accessibility, error, empty and loading states",
      "launch evidence and rollback-safe release metadata",
    ]),
  }),
  Object.freeze({
    version: FORGE_PRODUCT_PACKAGE_VERSION,
    id: "sauceapproved-ads",
    publicName: "SauceApproved Ads",
    descriptor: "AI Ad Maker",
    projectId: "sauceapproved-ads",
    sourceRoots: Object.freeze([
      "hercules-forge/ad-studio/index.html",
      "docs/HERCULES-AD-STUDIO.md",
      "tests/hercules-ad-studio.test.mjs",
    ]),
    ownership: COMMON_OWNERSHIP,
    deployment: COMMON_DEPLOYMENT,
    pricing: COMMON_PRICING,
    commerce: COMMON_COMMERCE,
    plans: Object.freeze({
      starter: Object.freeze({
        label: "Starter",
        audience: "Solo operators and small businesses",
        entitlements: Object.freeze([
          "campaign_workspaces",
          "message_angle_generation",
          "creative_exports",
          "utm_builder",
          "manual_performance_ledger",
        ]),
      }),
      pro: Object.freeze({
        label: "Pro",
        audience: "Growing brands",
        entitlements: Object.freeze([
          "starter_features",
          "brand_presets",
          "campaign_variants",
          "export_packages",
          "higher_campaign_limits",
        ]),
      }),
      agency: Object.freeze({
        label: "Agency",
        audience: "Agencies and multi-brand teams",
        entitlements: Object.freeze([
          "pro_features",
          "multi_brand_workspaces",
          "team_roles",
          "client_campaign_packages",
          "higher_usage_policy",
        ]),
      }),
    }),
    packagingGoals: Object.freeze([
      "upgrade the existing offline-first Ad Studio into a protected customer SaaS surface without deleting its deterministic core",
      "public SaaS landing and pricing experience",
      "authentication and protected customer workspace",
      "server-side plan entitlements and usage metering hooks",
      "billing adapter with verified webhook-driven subscription state",
      "customer billing and subscription status surface",
      "terms and privacy surfaces requiring owner approval before activation",
      "mobile, accessibility, error, empty and loading states",
      "launch evidence and rollback-safe release metadata",
    ]),
  }),
]);

function clone(value) {
  return structuredClone(value);
}

export function listForgeProductPackages() {
  return clone(PACKAGES);
}

export function getForgeProductPackage(id) {
  const item = PACKAGES.find(entry => entry.id === id);
  if (!item) throw new Error("unknown_forge_product_package:" + String(id ?? ""));
  return clone(item);
}

export function buildForgeProductPrompt(id) {
  const item = getForgeProductPackage(id);
  const roots = item.sourceRoots.map(path => "- " + path).join("\n");
  const goals = item.packagingGoals.map(goal => "- " + goal).join("\n");
  const plans = Object.entries(item.plans)
    .map(([key, plan]) => "- " + key + ": " + plan.label + " — " + plan.audience)
    .join("\n");

  return [
    "Package " + item.publicName + " (" + item.descriptor + ") as a sellable SauceApproved SaaS product inside Hercules Forge.",
    "",
    "Canonical owned source:",
    roots,
    "",
    "Preserve the existing owned product core. Extend it; do not replace it with a duplicate or a hosted-builder implementation.",
    "Do not replace the owned core with a hosted builder. Keep external infrastructure replaceable and behind explicit adapters.",
    "AppDeploy is not required for build, release, deployment, or verification. Provider credit ceilings must not block the owned Hercules release path.",
    "Use Hercules Forge Builder as the control plane and Hercules Deploy as the release runtime. Use Supabase for the owned archive/origin layer and the verified Render presentation runtime for browser delivery.",
    "",
    "Required productization:",
    goals,
    "",
    "Plans to model:",
    plans,
    "",
    "Candidate monthly pricing is Starter $29, Pro $79, Agency $199, but pricing remains owner approval required.",
    "Keep checkout disabled until owner approval exists for pricing, terms and privacy, the payment provider is ready, and a controlled paid checkout has been verified.",
    "All authorization, plan entitlements, usage limits, billing state and protected actions must be enforced server-side.",
    "Preserve provenance, integrity checks, exact-head release discipline and rollback evidence required by the Hercules Build Standard.",
  ].join("\n");
}
