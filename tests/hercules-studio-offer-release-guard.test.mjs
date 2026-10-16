import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  STUDIO_OFFER_SLUG, STUDIO_APPROVED_SHA, STUDIO_LEGACY_SHA,
  studioReleaseSourceCheck, guardedStudioPresentationWrite,
  verifyStudioPublicArtifact,
} from '../supabase/functions/hercules-deploy-controller/studio-offer-release-guard.mjs';

const approved=readFileSync(new URL('../hercules-forge/offers/sauceapproved-studio/index.html', import.meta.url),'utf8');
const checksum=s=>createHash('sha256').update(s).digest('hex');
const body=(data,status=200,ctype='text/html; charset=utf-8')=>
  new Response(data,{status,headers:{'content-type':ctype}});

test('approved Studio offer is pinned to the exact reviewed source, no payment approval',async()=>{
  assert.equal(STUDIO_OFFER_SLUG,'sauceapproved-studio-offer');
  assert.equal(checksum(approved),STUDIO_APPROVED_SHA);
  assert.match(STUDIO_LEGACY_SHA,/^[0-9a-f]{64}$/);
  assert.deepEqual(await studioReleaseSourceCheck({
    slug:STUDIO_OFFER_SLUG, html:approved, claimedSha:STUDIO_APPROVED_SHA, previousSha:STUDIO_LEGACY_SHA
  }),{ok:true,sha256:STUDIO_APPROVED_SHA});
  for(const [slug,html,claimedSha,previousSha] of [
    ['sauceapproved-studio',approved,STUDIO_APPROVED_SHA,STUDIO_LEGACY_SHA],
    [STUDIO_OFFER_SLUG,approved+' ',STUDIO_APPROVED_SHA,STUDIO_LEGACY_SHA],
    [STUDIO_OFFER_SLUG,approved,'f'.repeat(64),STUDIO_LEGACY_SHA],
    [STUDIO_OFFER_SLUG,approved,STUDIO_APPROVED_SHA,'f'.repeat(64)],
    [STUDIO_OFFER_SLUG,'<html>wrong</html>',STUDIO_APPROVED_SHA,STUDIO_LEGACY_SHA],
  ]) {
    assert.equal((await studioReleaseSourceCheck({slug,html,claimedSha,previousSha})).ok,false);
  }
});

test('public artifact verification requires exact hash and html and retries only transient 503',async()=>{
  const attempts=[];
  const fetchImpl=async(url,opts)=>{
    attempts.push({url,opts});
    return attempts.length<3?body('sleeping',503,'text/plain'):body(approved);
  };
  const result=await verifyStudioPublicArtifact({
    url:'https://sauceapproved-forge-host.onrender.com/sauceapproved-studio-offer/',
    expectedSha:STUDIO_APPROVED_SHA,
    fetchImpl,sleepImpl:async()=>{},
  });
  assert.equal(result.ok,true);
  assert.equal(result.attempts,3);
  assert.equal(result.observedSha256,STUDIO_APPROVED_SHA);
  assert.ok(attempts.every(q=>q.opts.method==='GET'&&q.opts.redirect==='manual'&&q.opts.credentials==='omit'&&!('Authorization' in q.opts.headers)));
});

test('HTML 200 with wrong bytes, redirect, or wrong content type never passes',async()=>{
  for(const fake of [
    body('not the approved page'),
    body(approved,200,'application/octet-stream'),
    new Response(null,{status:302,headers:{location:'https://attacker.example'}}),
  ]) {
    const result=await verifyStudioPublicArtifact({url:'https://sauceapproved-forge-host.onrender.com/sauceapproved-studio-offer/',expectedSha:STUDIO_APPROVED_SHA,fetchImpl:async()=>fake,sleepImpl:async()=>{}});
    assert.equal(result.ok,false);
  }
});

test('failed publication restores the previous exact bytes and does not declare success',async()=>{
  const old='legacy-old-html', fresh=approved;
  let current=old;
  const writes=[];
  const storage={
    read:async()=>current,
    write:async(s)=>{writes.push(s);current=s;},
  };
  const result=await guardedStudioPresentationWrite({
    slug:STUDIO_OFFER_SLUG,html:fresh,
    claimedSha:STUDIO_APPROVED_SHA,previousSha:checksum(old),pinnedPreviousSha:checksum(old),
    storage,
    publicUrl:'https://sauceapproved-forge-host.onrender.com/sauceapproved-studio-offer/',
    fetchImpl:async()=>body('wrong html'),
    sleepImpl:async()=>{},
  });
  assert.equal(result.ok,false);
  assert.equal(result.rolledBack,true);
  assert.deepEqual(writes,[fresh,old]);
  assert.equal(current,old);
});

test('unauthorized or wrong previous revision fails before any Storage upload',async()=>{
  let writes=0;
  const storage={read:async()=>'<html>concurrent update</html>',write:async()=>{writes++}};
  const result=await guardedStudioPresentationWrite({
    slug:STUDIO_OFFER_SLUG,html:approved,claimedSha:STUDIO_APPROVED_SHA,
    previousSha:STUDIO_LEGACY_SHA,pinnedPreviousSha:STUDIO_LEGACY_SHA,
    storage,publicUrl:'https://sauceapproved-forge-host.onrender.com/sauceapproved-studio-offer/',
    fetchImpl:async()=>body(approved),sleepImpl:async()=>{},
  });
  assert.equal(result.ok,false);
  assert.equal(result.reason,'previous_source_changed');
  assert.equal(writes,0);
});

test('rollback cannot overwrite a concurrent publisher or claim completion',async()=>{
  const old='old review', currentHash=checksum(old);
  let current=old;
  const writes=[];
  const storage={read:async()=>current,write:async(value)=>{writes.push(value);current=value;}};
  const result=await guardedStudioPresentationWrite({
    slug:STUDIO_OFFER_SLUG,html:approved,claimedSha:STUDIO_APPROVED_SHA,
    previousSha:currentHash,pinnedPreviousSha:currentHash,storage,
    publicUrl:'https://sauceapproved-forge-host.onrender.com/sauceapproved-studio-offer/',
    fetchImpl:async()=>{
      current='different author changed file';
      return body('unverified');
    },sleepImpl:async()=>{},
  });
  assert.equal(result.ok,false);
  assert.equal(result.rolledBack,false);
  assert.equal(result.reason,'verification_failed_concurrent_change');
  assert.deepEqual(writes,[approved]);
  assert.equal(current,'different author changed file');
});

test('rollback write errors are explicit instead of silently certifying old page',async()=>{
  const old='previous-content';
  let writes=0;
  const storage={
    read:async()=>writes===0?old:approved,
    write:async()=>{writes++;if(writes===2)throw new Error('secret backtrace');},
  };
  const result=await guardedStudioPresentationWrite({
    slug:STUDIO_OFFER_SLUG,html:approved,claimedSha:STUDIO_APPROVED_SHA,
    previousSha:checksum(old),pinnedPreviousSha:checksum(old),storage,
    publicUrl:'https://sauceapproved-forge-host.onrender.com/sauceapproved-studio-offer/',
    fetchImpl:async()=>body('wrong'),
    sleepImpl:async()=>{},
  });
  assert.equal(result.ok,false);
  assert.equal(result.rolledBack,false);
  assert.equal(result.reason,'rollback_failed');
  assert.equal(JSON.stringify(result).includes('secret backtrace'),false);
});

test('real deployed controller wiring preserves owner authorization and scopes guarded action to the Studio offer',()=>{
  const src=readFileSync(new URL('../supabase/functions/hercules-deploy-controller/index.ts',import.meta.url),'utf8');
  const login=src.indexOf("const internalOk=await internal(req)");
  const gate=src.indexOf("if(!internalOk&&!a)return out({error:'owner_admin_or_internal_required'},403)");
  const action=src.indexOf("if(action==='deploy_static'){");
  const studio=src.indexOf("const studioOnly=slug===STUDIO_OFFER_SLUG;",action);
  assert.ok(login>0&&gate>login&&action>gate&&studio>action);
  assert.match(src,/from '\.\/studio-offer-release-guard\.mjs'/);
  assert.match(src,/studioReleaseSourceCheck\(/);
  assert.match(src,/guardedStudioPresentationWrite\(/);
  assert.match(src,/pinnedPreviousSha:STUDIO_LEGACY_SHA/);
  assert.match(src,/if\(studioOnly\)/);
  assert.match(src,/if\(org!==PRESENTATION_ORG\)return out\(\{error:'studio_organization_not_authorized'\},403\)/);
  assert.match(src,/if\(!guarded\.ok\)throw new Error/);
  assert.match(src,/await verifyUrl\(stableUrl\)/);
  assert.doesNotMatch(src,/process\.env\.|SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"]/);
});
