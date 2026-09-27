import test from "node:test";
import assert from "node:assert/strict";
import {bankConsoleHtml,bankConsoleJs} from "../hercules-bank/console.mjs";

test("owner console exposes readiness drift status without activation controls",()=>{
  const html=bankConsoleHtml();const js=bankConsoleJs();
  assert.match(html,/Readiness drift/i);
  assert.match(html,/id="driftStatus"/);
  assert.match(js,/\/v1\/admin\/readiness-drift/);
  assert.match(js,/driftStatus/);
  assert.equal(/activate live money/i.test(html),false);
  assert.equal(/enable external rails/i.test(html),false);
});
