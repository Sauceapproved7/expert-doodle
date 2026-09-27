import test from "node:test";
import assert from "node:assert/strict";

import {bankConsoleHtml,bankConsoleJs} from "../hercules-bank/console.mjs";

test("owner console shows production readiness dossier but no activation control",()=>{
  const html=bankConsoleHtml();
  const js=bankConsoleJs();

  assert.match(html,/Production readiness/i);
  assert.match(html,/Activation locked/i);
  assert.match(html,/Transactional store/i);
  assert.match(html,/Key custody/i);
  assert.match(html,/Recovery proof/i);
  assert.match(js,/\/v1\/admin\/production-readiness/);
  assert.equal(/activate live money/i.test(html),false);
  assert.equal(/enable external rails/i.test(html),false);
  assert.equal(/activationAllowed\s*=\s*true/i.test(js),false);
});
