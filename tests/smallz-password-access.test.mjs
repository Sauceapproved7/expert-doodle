import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function consoleWith(authOverrides={}){
  const html=await readFile(new URL('../hercules-bot/index.html',import.meta.url),'utf8');
  const elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',className:'',disabled:false});return elements.get(id)};
  const calls=[];
  const auth={getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>{},signOut:async()=>{},
    signInWithPassword:async payload=>{calls.push(payload);return {data:{session:{access_token:'test-session'}},error:null}},...authOverrides};
  const context=vm.createContext({document:{getElementById:element},window:{},location:{origin:'https://smallz-hercules.onrender.com'},setInterval:()=>{},
    createClient:()=>({auth}),fetch:async(url,options)=>url==='/api/auth-config'?{ok:true,json:async()=>({url:'https://auth.example',key:'public'})}:{ok:false,json:async()=>({error:'owner-identity-rejected'})}});
  const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/import\{createClient\}from[^;]+;/,'');
  await vm.runInContext(`(async()=>{${script}})()`,context);
  return {element,calls,window:context.window};
}

test('existing password signs in without email redirect and is immediately cleared',async()=>{
  const c=await consoleWith();c.element('email').value=' owner@example.com ';c.element('password').value='test-password';
  assert.equal(typeof c.window.signinPassword,'function');
  await c.window.signinPassword();
  assert.equal(c.calls[0].email,'owner@example.com');assert.equal(c.calls[0].password,'test-password');
  assert.equal(c.element('password').value,'');
  assert.equal(c.element('body').textContent,'LOCKED','authenticated non-owner is denied by server');
});
test('provider failure clears password and hides raw credential-shaped error',async()=>{
  const c=await consoleWith({signInWithPassword:async()=>{throw Error('private-provider-detail')}});
  c.element('email').value='owner@example.com';c.element('password').value='test-password';
  await c.window.signinPassword();
  assert.equal(c.element('password').value,'');assert.doesNotMatch(c.element('auth').textContent,/private-provider-detail/);
});
test('empty credentials do not attempt authentication',async()=>{
  const c=await consoleWith();await c.window.signinPassword();assert.equal(c.calls.length,0);
});
