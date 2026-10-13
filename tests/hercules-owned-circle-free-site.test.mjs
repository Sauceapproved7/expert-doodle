import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('hercules-deploy/owned-circle/free-site/index.html');
const js=read('hercules-deploy/owned-circle/free-site/app.mjs');
const css=read('hercules-deploy/owned-circle/free-site/app.css');
const build=read('scripts/build_hercules_owned_circle_static.mjs');
test('founding app has consent, free benefits and honest status',()=>{
 for(const expected of ['HERCULES','FOUNDING CIRCLE','Free','No payment required','Unverified interest','Owner','Founding Circle Toolkit','Email confirmation is not active','hosting'])assert.ok(html.toLowerCase().includes(expected.toLowerCase()),expected);
 assert.match(html,/type="email"[^>]*name="email"/i);
 assert.match(html,/name="consent"[^>]*required/i);
 assert.match(html,/SauceApproved Privacy Policy/i);
 assert.match(html,/href="https:\/\/hercules-cloud-origin-preview\.onrender\.com\/circle\.html"/i);
 assert.doesNotMatch(html,/type="password"|card_number|paid checkout|guaranteed beta access/i);
});
test('owned app communicates only with exact existing private-writer RPC',()=>{
 assert.match(js,/https:\/\/xbwuablxhhwsaoomsoco\.supabase\.co\/rest\/v1\/rpc\/hercules_cloud_join_founders/);
 assert.match(js,/sb_publishable_/);
 assert.match(js,/p_email/);
 assert.match(js,/p_consent/);
 assert.match(js,/p_interest/);
 assert.match(js,/p_website/);
 assert.match(js,/Interest recorded as unverified/);
 assert.doesNotMatch(js,/service_role|sb_secret_|smtp|stripe|checkout|authorization\s*:/i);
 assert.doesNotMatch(js,/localStorage|sessionStorage|document\.cookie|eval\(/i);
});
test('the independent static artifact is built without backend secrets, paid plans or remote dependencies',()=>{
 assert.match(build,/dist\/hercules-owned-circle/);
 for(const f of ['index.html','app.css','app.mjs'])assert.ok(build.includes(f));
 assert.doesNotMatch(css,/@import|fonts\.googleapis\.com|https?:\/\//);
 assert.doesNotMatch(html,/<script[^>]+src="https?:\/\//i);
});
