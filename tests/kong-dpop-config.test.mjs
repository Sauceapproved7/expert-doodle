import test from "node:test";import assert from "node:assert/strict";import{readFile}from"node:fs/promises";
const c=await readFile(new URL("../infra/kong/hercules-dpop.yaml",import.meta.url),"utf8");
test("Kong Hercules gateway baseline uses strict DPoP and deployment-time secrets",()=>{assert.match(c,/openid-connect/);assert.match(c,/proof_of_possession_dpop:\s*strict/);assert.match(c,/HERCULES_OIDC_ISSUER/);assert.match(c,/HERCULES_OIDC_CLIENT_SECRET/);assert.doesNotMatch(c,/client_secret:\s*[^\$\n]/)});
