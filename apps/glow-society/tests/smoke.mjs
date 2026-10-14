import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const base = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', base), 'utf8');
const js = readFileSync(new URL('app.js', base), 'utf8');
const css = readFileSync(new URL('styles.css', base), 'utf8');

test('standalone files are present and JavaScript parses', () => {
  assert.ok(html.length > 5000 && css.length > 5000 && js.length > 10000);
  assert.doesNotThrow(() => new Script(js, { filename: 'app.js' }));
  assert.match(html, /<script src="\.\/app\.js" defer><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="\.\/styles\.css"/);
});

test('main navigation references real views', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  for (const section of ['discover','explore','studio','community','artists','saved']) {
    assert.ok(ids.has(section), 'missing view: ' + section);
  }
  for (const match of js.matchAll(/\bel\('([^']+)'\)/g)) {
    if (match[1] === 'lookStack') continue; // inserted in the UI on startup
    assert.ok(ids.has(match[1]), 'JavaScript refers to missing HTML id: ' + match[1]);
  }
});

test('catalog includes rich looks for Black women', () => {
  for (const region of ['lips', 'cheeks', 'eyes', 'hair', 'nails']) {
    assert.ok(js.includes("seed('" + region + "',["));
  }
  for (const phrase of ['deep','warm','cool','neutral','olive','4C Crown Coils',
    'Knotless Goddess Braids','Silk Press Espresso','Fulani Braids',
    'Jet Black Sew-In','Locs','Espresso French']) {
    assert.ok(js.includes(phrase), 'Missing core inclusive feature: ' + phrase);
  }
  const productCount = [...js.matchAll(/^\s+\['[^']+','#[\da-f]{6}',\[/gmi)].length;
  assert.ok(productCount >= 45, 'Too few demo products: ' + productCount);
});

test('photo mode is clearly distinguished from tracked AR', () => {
  assert.match(html, /MANUAL OVERLAY • NOT FACE TRACKING/);
  assert.match(html, /For inspiration only/);
  assert.match(js, /FaceLandmarker/);
  assert.match(js, /HandLandmarker/);
  assert.match(js, /detectForVideo/);
  assert.match(js, /cameraStream\.getTracks\(\)\.forEach/);
  assert.match(js, /getUserMedia/);
});

test('camera stop remains available while camera runs and mirrored rear view is corrected', () => {
  assert.match(js, /el\('startCamera'\)\.hidden=isPhoto\|\|!!cameraStream/);
  assert.match(js, /el\('stopCamera'\)\.hidden=isPhoto\|\|!cameraStream/);
  assert.match(js, /video\.style\.transform=mirrored\?'scaleX\(-1\)':'none'/);
});

test('no public checkout, photo upload, or fabricated artist booking', () => {
  assert.match(html, /Private demo feed/i);
  assert.match(html, /not a reliable foundation or hair-color match/i);
  assert.match(js, /URL\.createObjectURL\(file\)/);
  assert.doesNotMatch(js, /fetch\(\s*['"]https?:\/\/[^'"]+\/(upload|checkout|payment)/i);
  assert.doesNotMatch(js, /STRIPE_SECRET|SHOPIFY_ACCESS_TOKEN|SUPABASE_SERVICE_ROLE/);
  assert.match(js, /localStorage/);
});

test('small screens and reduced-motion visitors are supported', () => {
  assert.match(html, /name="viewport"/);
  assert.match(css, /@media\(max-width:690px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
test('preview is explicitly not indexed', () => {
  const robots = readFileSync(new URL('robots.txt', base), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive"\/>/);
  assert.match(robots, /Disallow: \/\s*$/m);
});
