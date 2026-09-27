import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const filed="SauceApproved enterprise LLC";
const wrong="SauceApproved Enterprise LLC";
const files=[
  "docs/launch/HERCULES-PRICING-PROPOSAL.md",
  "docs/launch/HERCULES-TERMS-OF-SERVICE-DRAFT.md",
  "docs/HERCULES-SOCIAL-OWNER-HANDOFF-V1.md",
  "docs/launch/HERCULES-STRIPE-ACTIVATION-PACKET-2026-09-27.md",
  "docs/launch/SAUCEAPPROVED-LINKEDIN-PAGE-V1.md",
  "docs/launch/HERCULES-PRIVACY-POLICY-DRAFT.md",
  "docs/launch/HERCULES-EIGHT-PART-LAUNCH-CLOSEOUT-2026-09-27.md",
  "governance/sauceapproved-linkedin-page-v1.json",
  "supabase/functions/hercules-integrations/index.ts"
];

test("launch-facing legal identity matches the Connecticut filed name",async()=>{
  for(const path of files){
    const content=await readFile(new URL("../"+path,import.meta.url),"utf8");
    assert.equal(content.includes(wrong),false,path+" contains incorrect legal-entity capitalization");
    assert.equal(content.includes(filed),true,path+" does not contain filed legal entity name");
  }
});
