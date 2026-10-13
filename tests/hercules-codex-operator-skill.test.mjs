import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const target = new URL('../.agents/skills/hercules-codex-operator/SKILL.md', import.meta.url);
const content = (() => {
  try { return readFileSync(target, 'utf8'); }
  catch { return ''; }
})();

test('Hercules Codex operator is discoverable as a repository skill', () => {
  assert.match(content, /^---\nname: hercules-codex-operator\ndescription: .+\n---\n/u);
  assert.match(content, /Codex Cloud|coding tasks/u);
});

test('skill uses existing evidence checks and rejects cloud-registration assumptions', () => {
  for (const command of [
    'node scripts/hercules-codex-cloud-handoff.mjs --json',
    'node scripts/hercules-codex-doctor.mjs --json',
    'node scripts/hercules-preflight.mjs',
  ]) assert.ok(content.includes(command), 'Missing command ' + command);
  assert.match(content, /do not claim[^\n]*published/iu);
  assert.match(content, /Cloud environment publication[^\n]*account-side/iu);
});

test('skill forbids live deployment, commercial changes, secret access and automatic merge', () => {
  for (const phrase of ['production deploy', 'payment', 'credentials', 'merge']) {
    assert.ok(content.toLowerCase().includes(phrase), 'missing safety boundary ' + phrase);
  }
  assert.match(content, /reviewable pull request/iu);
  assert.match(content, /Do not merge/iu);
});

test('skill explicitly separates Codex Cloud from browser actions and Codex usage', () => {
  assert.match(content, /computer and browser use[^\n]*not supported/iu);
  assert.match(content, /usage limit/iu);
  assert.doesNotMatch(content, /curl[^\n]*\|[^\n]*(?:sh|bash)/u);
});
