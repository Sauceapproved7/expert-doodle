import test from "node:test";
import assert from "node:assert/strict";

import {bankConsoleHtml,bankConsoleJs} from "../hercules-bank/console.mjs";

test("owner console exposes compliance readiness without a live-money activation control",()=>{
  const html=bankConsoleHtml();
  const js=bankConsoleJs();

  assert.match(html,/Compliance readiness/i);
  assert.match(html,/Regulated controls/i);
  assert.match(html,/Live money locked/i);
  assert.match(js,/\/v1\/admin\/compliance/);
  assert.equal(/activate live money/i.test(html),false);
  assert.equal(/enable external rails/i.test(html),false);
});
