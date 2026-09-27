import test from "node:test";
import assert from "node:assert/strict";

import {bankConsoleHtml,bankConsoleJs} from "../hercules-bank/console.mjs";

test("owner production readiness surface shows qualification evidence freshness",()=>{
  const html=bankConsoleHtml();
  const js=bankConsoleJs();
  assert.match(html,/Qualification evidence/i);
  assert.match(html,/id="readyQualification"/);
  assert.match(js,/adapterQualification/);
  assert.match(js,/readyQualification/);
  assert.equal(/activate live money/i.test(html),false);
  assert.equal(/enable external rails/i.test(html),false);
});
