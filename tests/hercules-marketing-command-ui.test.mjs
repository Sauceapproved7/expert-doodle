import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const html=readFileSync(new URL('../hercules-marketing-command/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../hercules-marketing-command/style.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../hercules-marketing-command/app.mjs',import.meta.url),'utf8');

test('standalone console is mobile-ready and deliberately unindexed',()=>{
  assert.match(html,/name="viewport"/);
  assert.match(html,/name="robots" content="noindex,nofollow"/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(html,/id="campaign-form"/);
  assert.match(html,/id="economics"/);
  assert.match(html,/id="opportunity-form"/);
});

test('CSP blocks external network and no outside assets are embedded',()=>{
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/form-action 'none'/);
  assert.match(html,/src="\.\/app\.mjs"/);
  assert.doesNotMatch(html,/<script[^>]*src="https?:|<iframe|<link[^>]*href="https?:/);
  assert.doesNotMatch(app,/\bfetch\s*\(|XMLHttpRequest|WebSocket\s*\(|sendBeacon\s*\(/);
});

test('draft console never sends, publishes, stores leads or calls customer APIs',()=>{
  assert.doesNotMatch(app,/\blocalStorage\b|\bindexedDB\b|\bsessionStorage\b/);
  assert.doesNotMatch(app,/innerHTML|insertAdjacentHTML|eval\s*\(|new Function/);
  assert.match(app,/textContent/);
  assert.match(app,/publishAuthorized:false/);
  assert.match(app,/paidAdvertisingAuthorized:false/);
});

test('all marketed divisions, safety boundaries and institutional non-affiliation are visible',()=>{
  for(const value of ['apparel','forge','studio','titan','gatehouse','meta_ads','google_ads'])assert.ok(html.includes('value="'+value+'"'));
  for(const marker of ['NO AUTO-PUBLISH','REVIEW-ONLY','NOT AFFILIATED WITH NASA, SPACEX OR DARPA'])assert.ok(html.includes(marker));
});

test('client code and engine are syntactically valid Node ESM',()=>{
  const run=spawnSync(process.execPath,['--check',new URL('../hercules-marketing-command/app.mjs',import.meta.url).pathname],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
});
