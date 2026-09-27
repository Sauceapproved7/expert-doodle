import test from "node:test";
import assert from "node:assert/strict";

import {
  bankConsoleHtml,
  bankConsoleCss,
  bankConsoleJs,
  bankConsoleAsset,
} from "../hercules-bank/console.mjs";

test("bank console is a complete sandbox customer surface", () => {
  const html=bankConsoleHtml();
  const css=bankConsoleCss();
  const js=bankConsoleJs();

  assert.match(html,/HERCULES FINANCIAL/i);
  assert.match(html,/SANDBOX/i);
  assert.match(html,/Sign in/i);
  assert.match(html,/Accounts/i);
  assert.match(html,/Transfer/i);
  assert.match(css,/grid/i);
  assert.match(js,/\/v1\/session/);
  assert.match(js,/\/v1\/accounts/);
  assert.match(js,/\/v1\/transfers/);
});

test("bank console never persists access or refresh tokens in browser storage", () => {
  const js=bankConsoleJs();

  assert.equal(/localStorage/i.test(js),false);
  assert.equal(/sessionStorage/i.test(js),false);
  assert.equal(/access_token/i.test(js),false);
  assert.equal(/refresh_token/i.test(js),false);
  assert.match(js,/credentials:"same-origin"/);
  assert.match(js,/x-bank-csrf/);
});

test("bank console assets expose only the intended paths", () => {
  assert.equal(bankConsoleAsset("/").type,"text/html; charset=utf-8");
  assert.equal(bankConsoleAsset("/bank-console.css").type,"text/css; charset=utf-8");
  assert.equal(bankConsoleAsset("/bank-console.js").type,"text/javascript; charset=utf-8");
  assert.equal(bankConsoleAsset("/nope"),null);
});
