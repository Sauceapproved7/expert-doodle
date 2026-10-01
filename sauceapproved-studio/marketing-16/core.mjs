const MODULES = Object.freeze([
  ["THE MACHINE","orchestrate","Turns verified signals into a bounded growth plan."],
  ["Product Intelligence Engine","intelligence","Scores product demand, margin, proof, and merchandising gaps."],
  ["Creative Lab","creative","Generates evidence-linked creative hypotheses and briefs."],
  ["Offer Architect","offer","Builds bounded offer structures from verified economics."],
  ["Ad Economics Calculator","economics","Models break-even CAC, ROAS, contribution margin, and refund drag."],
  ["Landing-Page Killer","conversion","Audits landing-page friction and prioritizes conversion fixes."],
  ["Retention Engine","retention","Finds repeat-purchase, lifecycle, and win-back opportunities."],
  ["Creative Performance Brain","learning","Turns creative performance evidence into reusable learning."],
  ["Daily Command Center","control","Ranks daily revenue actions, blockers, and evidence gaps."],
  ["BLACKBOX","synthesis","Synthesizes cross-module signals without exposing unsafe mutation paths."],
  ["Shadow Radar","radar","Detects emerging competitor, channel, and customer-pattern shifts."],
  ["Creative DNA","creative-memory","Extracts repeatable winning creative attributes."],
  ["Profit Sniper","profit","Ranks actions by verified contribution-profit opportunity."],
  ["Customer X-Ray","customer","Builds privacy-bounded customer insight from permitted evidence."],
  ["Kill Switch","safety","Stops actions when evidence, economics, policy, or authorization fails."],
  ["THE LAB","experimentation","Runs bounded experiment planning and evidence-based winner logic."]
]);

export function createMarketing16Manifest() {
  return {
    id: "hercules-marketing-16-v1",
    owner: "SauceApproved enterprise LLC",
    executionPolicy: "fail-closed",
    autoPublish: false,
    autoSpend: false,
    storefrontMutation: false,
    modules: MODULES.map(([name,kind,purpose],index)=>({
      id: `m${String(index+1).padStart(2,"0")}`,
      name, kind, purpose, evidenceRequired: true
    }))
  };
}

function cleanEvidence(ids) {
  return Array.isArray(ids) ? [...new Set(ids.map(String).map(x=>x.trim()).filter(Boolean))] : [];
}

export function planMarketing16Run(input={}) {
  const evidenceIds=cleanEvidence(input.evidenceIds);
  if (!evidenceIds.length) throw new Error("marketing_evidence_required");
  const brandId=String(input.brandId||"").trim();
  if (!brandId) throw new Error("marketing_brand_required");
  const objective=String(input.objective||"").trim();
  if (!objective) throw new Error("marketing_objective_required");

  const manifest=createMarketing16Manifest();
  return {
    suiteId: manifest.id,
    brandId,
    objective,
    evidenceIds,
    releaseReady: false,
    actions: manifest.modules.map(module=>({
      moduleId: module.id,
      moduleName: module.name,
      objective,
      evidenceIds,
      evidenceRequired: true,
      publishAllowed: false,
      spendAllowed: false,
      storefrontMutationAllowed: false,
      requiresExplicitReleaseAuthorization: true
    }))
  };
}
