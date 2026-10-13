import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const html=readFileSync(resolve(root,'hercules-deploy/cloud/index.html'),'utf8');
const css=readFileSync(resolve(root,'hercules-deploy/cloud/styles.css'),'utf8');
const js=readFileSync(resolve(root,'hercules-deploy/cloud/app.mjs'),'utf8');
const server=readFileSync(resolve(root,'hercules-deploy/cloud/server.mjs'),'utf8');
test('Hercules Cloud source is fully original local-asset UI with essential sections',()=>{
 for(const id of ['overview','fleet','shadow','shield','vault'])assert.match(html,new RegExp('id="'+id+'"'));
 for(const name of ['HERCULES','Shadow Dock','Titan Shield','Proof Vault','ORIGIN SYSTEM'])assert.ok(html.includes(name));
 assert.doesNotMatch(html,/https?:\/\/(?!preview\.example\.com)/);
 assert.doesNotMatch(css,/@import|fonts\.googleapis\.com|url\(['"]?https?:/i);
 assert.doesNotMatch(js,/fetch\(|localStorage|sessionStorage|eval\(|new Function\(/);
});
test('preflight preview refuses to assert provider completion',()=>{
 assert.match(html,/ARCHITECTURE \/ DEMO/);
 assert.match(js,/ready for staging: NO/);
 assert.match(js,/execution authorized: NO/);
 assert.match(js,/zero-new-cost evidence: NOT ATTESTED/);
 assert.match(js,/production changes: NONE/);
});
test('control API contains no deploy, shell or provider mutation route',()=>{
 assert.match(server,/createHerculesCloudServer/);
 assert.match(server,/owner_authority_not_configured/);
 assert.match(server,/owner_authority_required/);
 assert.doesNotMatch(server,/spawn\(|execFile\(|child_process|\/api\/deploy\b|\.deployRelease\(/);
});
