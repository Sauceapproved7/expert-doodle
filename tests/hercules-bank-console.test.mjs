import test from "node:test";
import assert from "node:assert/strict";

import {
  bankConsoleHtml,
  bankConsoleCss,
  bankConsoleJs,
  bankConsoleAsset,
} from "../hercules-bank/console.mjs";

test("bank console exposes customer banking surfaces and sandbox disclosure", () => {
  const html=bankConsoleHtml();
  const css=bankConsoleCss();
  const js=bankConsoleJs();

  assert.match(html,/HERCULES BANK/);
  assert.match(html,/Sandbox/);
  assert.match(html,/Available balance/);
  assert.match(html,/Send funds/);
  assert.match(html,/Transaction history/);
  assert.match(html,/Owner controls/);
  assert.match(css,/grid-template-columns/);
  assert.match(css,/@media/);
  assert.match(js,/\/v1\/accounts/);
  assert.match(js,/\/v1\/transfers/);
  assert.match(js,/\/v1\/admin\/overview/);
});

test("bank console consumes access token from fragment without persistent browser storage", () => {
  const js=bankConsoleJs();
  assert.match(js,/location\.hash/);
  assert.match(js,/history\.replaceState/);
  assert.match(js,/access_token/);
  assert.equal(js.includes("localStorage"),false);
  assert.equal(js.includes("sessionStorage"),false);
  assert.equal(js.includes("document.cookie"),false);
});

test("bank console assets are bounded to explicit routes", () => {
  assert.equal(bankConsoleAsset("/").type,"text/html; charset=utf-8");
  assert.equal(bankConsoleAsset("/console").type,"text/html; charset=utf-8");
  assert.equal(bankConsoleAsset("/bank-console.css").type,"text/css; charset=utf-8");
  assert.equal(bankConsoleAsset("/bank-console.js").type,"text/javascript; charset=utf-8");
  assert.equal(bankConsoleAsset("/unknown"),null);
});
