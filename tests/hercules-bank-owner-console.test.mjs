import test from "node:test";
import assert from "node:assert/strict";

import {bankConsoleHtml,bankConsoleJs} from "../hercules-bank/console.mjs";

test("Hercules Financial console includes owner control center hooks",()=>{
  const html=bankConsoleHtml();
  const js=bankConsoleJs();

  assert.match(html,/Owner controls/i);
  assert.match(html,/Sandbox liabilities/i);
  assert.match(html,/Add sandbox funds/i);
  assert.match(js,/\/v1\/admin\/overview/);
  assert.match(js,/\/v1\/admin\/fund-sandbox/);
  assert.match(js,/csrf:true/);

  assert.equal(/access_token/i.test(js),false);
  assert.equal(/refresh_token/i.test(js),false);
  assert.equal(/localStorage/i.test(js),false);
  assert.equal(/sessionStorage/i.test(js),false);
});
