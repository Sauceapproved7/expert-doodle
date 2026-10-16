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

test('cancelled asynchronous camera models are closed and camera sessions do not overlap', () => {
  assert.match(js, /if\(gen!==cameraGeneration\)return;\s*landmarker=pendingLandmarker/);
  assert.match(js, /if\(pendingLandmarker\)\{try\{pendingLandmarker\.close\(\)\}catch\{\}\}/);
  assert.match(js, /if\(cameraCheckPending\)\{toast\('Wait for the camera check/);
  assert.match(js, /if\(cameraStream\|\|cameraStarting\|\|cameraCheckPending\)/);
  assert.match(js, /if\(gen!==cameraGeneration\)\{stream\.getTracks\(\)\.forEach/);
  assert.match(js, /if\(gen!==cameraGeneration\)return;\s*const vision=/);
  assert.match(html, /id="runCameraCheck"/);
});


test('data vault uses two-step local-only deletion and safe download', () => {
  for (const id of ['exportLocalData','eraseLocalData','confirmEraseLocalData','cancelEraseLocalData','privacySummary','restoreMuted']) {
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(js, /function localDataSnapshot\(\)/);
  assert.match(js, /key\.startsWith\(prefix\)/);
  assert.match(js, /localStorage\.removeItem\(key\)/);
  assert.match(js, /scope:'browser-local-demo-data-only'/);
  assert.match(js, /new Blob\(\[JSON\.stringify\(snapshot,null,2\)\]/);
  assert.match(js, /state\.mutedAuthors\.clear\(\)/);
  assert.match(js, /if\(uploadedUrl\)\{URL\.revokeObjectURL\(uploadedUrl\)/);
  assert.doesNotMatch(js, /fetch\([^)]*\/report\b/);
});


test('human-reviewed physical AR checklist is session only and cannot certify accuracy',()=>{
  assert.match(html, /src="\.\/validation-kit\.js" defer/);
  assert.match(html, /id="validationScenarios"/);
  assert.match(html, /id="exportValidation"[^>]*disabled/);
  assert.match(html, /self-reported observation/);
  assert.match(js, /function validationEvidence\(mode\)/);
  assert.match(js, /if\(!marked\.length\)return/);
  assert.match(js, /validationKit\.clear\(\);observedModeStats=\{face:null,hand:null\}/);
  assert.match(js, /status:'self-reported-unverified'/);
  assert.doesNotMatch(js, /fetch\([^)]*validationReport/);
});


test('Beauty Match is opt-in, tag-based and independent from AR and Passport storage',()=>{
  assert.match(html,/src="\.\/beauty-match\.js" defer/);
  for(const id of ['beautyMatchForm','matchDepth','matchTone','matchTexture','matchCategory','matchVibe','matchClear','matchUsePassport','matchResults']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/not your face, an actual product shade/);
  assert.match(js,/window\.GlowBeautyMatch\.recommend\(ITEMS,prefs\)/);
  assert.match(js,/function resetBeautyMatch\(\)/);
  assert.match(js,/resetBeautyMatch\(\);/);
  assert.doesNotMatch(js,/fetch\([^)]*beautyMatch/);
});

test('supplier catalog intake never activates real commerce or trusts unverified sources',()=>{
  assert.match(html,/src="\.\/catalog-intake\.js" defer/);
  for(const id of ['catalogWorkshop','catalogFile','catalogSample','catalogTemplate','catalogReset','catalogIntakeStatus','catalogIntakeResults']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/REVIEW ONLY · NOT PUBLISHED/);
  assert.match(js,/window\.GlowCatalogIntake\.parse\(raw\)/);
  assert.match(js,/window\.GlowCatalogIntake\.validate\(window\.GlowCatalogIntake\.sample\)/);
  assert.match(js,/function resetCatalogReview\(\)/);
  assert.match(js,/resetCatalogReview\(\);/);
  assert.match(js,/Published: 0/);
  assert.doesNotMatch(js,/fetch\([^)]*catalogFile/);
});

test('supplier evidence review remains offline, unverified and fails closed',()=>{
  assert.match(html,/src="\.\/supplier-review\.js" defer/);
  for(const id of ['supplierReviewStatus','supplierReviewExport','supplierReviewReset']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/No selection establishes supplier legitimacy/);
  assert.match(js,/window\.GlowSupplierReview\.create\(report\.items\)/);
  assert.match(js,/supplierReviewExport/);
  assert.match(js,/downloadSupplierReview/);
  assert.match(js,/catalogEvidenceKit=null;/);
  assert.match(js,/Approved: 0\. Published: 0/);
  assert.doesNotMatch(js,/fetch\([^)]*supplierReview/);
});

test('local review restoration requires exact unverified packet and matching feed',()=>{
  assert.match(html,/src="\.\/supplier-restore\.js" defer/);
  for(const id of ['supplierRestoreFile','supplierRestoreStatus','supplierRestoreHelp']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/First load the exact same supplier feed/);
  assert.match(js,/window\.GlowSupplierRestore\.parse\(raw,baseline\)/);
  assert.match(js,/window\.GlowSupplierRestore\.preview\(validation,baseline\)/);
  assert.match(js,/function confirmSupplierRestore\(\)/);
  assert.match(js,/staged\.kit\.apply\(staged\.changes\)/);
  for(const id of ['supplierRestorePreview','supplierRestorePreviewSummary','supplierRestoreChanges','supplierRestoreApply','supplierRestoreCancel']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(js,/function resetSupplierRestore\(/);
  assert.match(js,/catalogRestoreGeneration/);
  assert.match(js,/Restore rejected/);
  assert.doesNotMatch(js,/fetch\([^)]*supplierRestore/);
});
