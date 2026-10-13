import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const founders=read('hercules-deploy/cloud/founders.html');
const homepage=read('hercules-deploy/cloud/index.html');
const circle=read('hercules-deploy/cloud/circle.html');
const script=read('hercules-deploy/cloud/circle.mjs');
const guide=read('hercules-deploy/cloud/hercules-cloud-founder-field-guide.md');
const build=read('scripts/build_hercules_cloud_preview.mjs');
const intake=read('hercules-deploy/cloud/founders.mjs');

test('free membership proposition has honest immediate and future benefits',()=>{
 assert.match(founders,/Hercules Cloud Founding Circle/i);
 assert.match(founders,/FREE\/ \$0|FREE · \$0|FREE — \$0/i);
 assert.match(founders,/No payment required/i);
 assert.match(founders,/Free toolkit/i);
 assert.match(founders,/Live preview/i);
 assert.match(founders,/Founding updates/i);
 assert.match(founders,/Early tester consideration/i);
 assert.match(founders,/founding-member pricing.*not guaranteed/is);
 assert.match(founders,/Email confirmation is not yet active/i);
 assert.match(founders,/not a Hercules account/i);
 assert.match(founders,/No hosted deployments/i);
 assert.match(founders,/privacy policy/i);
 assert.match(founders,/name="consent"[^>]*required/i);
 assert.match(founders,/href="\/circle\.html"/i);
 assert.match(homepage,/Founding Circle/i);
});

test('members get useful self-contained downloadable guide and interactive checklist',()=>{
 assert.match(circle,/Founding Circle Toolkit/i);
 assert.match(circle,/Host ownership/i);
 assert.match(circle,/Independent cost verification/i);
 assert.match(circle,/Rollback proof/i);
 assert.match(circle,/Private credentials/i);
 assert.match(circle,/No cloud deployment is performed/i);
 assert.match(circle,/href="\/hercules-cloud-founder-field-guide\.md"/i);
 assert.match(circle,/circle\.mjs/i);
 assert.match(script,/addEventListener\('change'/i);
 assert.match(script,/readiness-score/i);
 assert.doesNotMatch(script,/fetch\(|localStorage|sessionStorage|service_role|sb_secret_|exec\(/i);
 assert.match(guide,/Hercules Cloud Founding Circle Field Guide/i);
 assert.match(guide,/Rootless Docker/i);
 assert.match(guide,/Cost verification/i);
 assert.match(guide,/Rollback/i);
 assert.match(guide,/No production deployment is authorized/i);
});

test('static release bundles all locally owned tools and does not change signup endpoint',()=>{
 for(const a of ["'circle.html'","'circle.css'","'circle.mjs'","'hercules-cloud-founder-field-guide.md'"]) {
   assert.ok(build.includes(a),a);
 }
 assert.match(intake,/rest\/v1\/rpc\/hercules_cloud_join_founders/);
 assert.doesNotMatch(intake,/service_role|stripe|payment|auth\/v1\/signup/i);
});
