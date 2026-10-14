import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const code=readFileSync(new URL('../beauty-match.js',import.meta.url),'utf8');
function engine(){
 const window={};runInNewContext(code,{window});return window.GlowBeautyMatch;
}
const concepts=[
 {id:'lip-deep-cool',category:'makeup',region:'lips',name:'Black Cherry',desc:'Berry lip',tags:['deep','cool']},
 {id:'lip-deep-warm',category:'makeup',region:'lips',name:'Chocolate Muse',desc:'Warm lip',tags:['deep','warm']},
 {id:'cheek-deep-cool',category:'makeup',region:'cheeks',name:'Mulberry',desc:'Berry cheek',tags:['deep','cool']},
 {id:'eye-light-cool',category:'makeup',region:'eyes',name:'Rose',desc:'Soft eye',tags:['light','cool']},
 {id:'hair-4c',category:'hair',region:'hair',name:'4C Crown Coils',desc:'Natural',tags:['4c','coils']},
 {id:'hair-braids',category:'hair',region:'hair',name:'Knotless Braids',desc:'Protective',tags:['braids','protective']},
 {id:'nail-espresso',category:'nails',region:'nails',name:'Espresso French',desc:'Deep brown',tags:['french','short']}
];
test('deep-cool makeup recommendations do not silently include untagged lighter shades',()=>{
 const matches=engine().recommend(concepts,{category:'makeup',depth:'deep',tone:'cool'});
 assert.equal(matches.length,2);
 assert.ok(matches.every(x=>['lip-deep-cool','cheek-deep-cool'].includes(x.id)));
 assert.ok(matches.every(x=>x.reason.includes('deep')&&x.reason.includes('cool')));
});
test('4C hair mode excludes braids when they are not tagged 4C',()=>{
 const matches=engine().recommend(concepts,{category:'hair',texture:'4c'});
 assert.equal(matches.length,1);
 assert.equal(matches[0].id,'hair-4c');
 assert.match(matches[0].reason,/4C/);
});
test('all-category edit includes makeup, hair and nails without assuming nail-shade accuracy',()=>{
 const matches=engine().recommend(concepts,{category:'all',depth:'deep',tone:'cool',texture:'4c'});
 const ids=matches.map(m=>m.id);
 assert.ok(ids.includes('hair-4c'));
 assert.ok(ids.includes('nail-espresso'));
 assert.ok(ids.includes('lip-deep-cool'));
 assert.ok(!ids.includes('lip-deep-warm'));
 assert.ok(!ids.includes('hair-braids'));
 assert.match(matches.find(x=>x.id==='nail-espresso').reason,/nail design inspiration/);
});
test('missing combinations remain empty rather than asserting false color matches',()=>{
 const matches=engine().recommend(concepts,{category:'makeup',depth:'light',tone:'olive'});
 assert.equal(matches.length,0);
});
test('the engine never captures personal data or mutates source concepts',()=>{
 const copy=JSON.stringify(concepts);
 const matches=engine().recommend(concepts,{category:'all',vibe:'statement'});
 assert.equal(JSON.stringify(concepts),copy);
 assert.equal(Object.isFrozen(matches),true);
 assert.ok(matches.every(x=>Object.keys(x).sort().join(',')==='id,reason'));
 const defaults=engine().normalize({depth:'malicious',texture:'what',category:'other'});
 assert.equal(defaults.depth,'all');
 assert.equal(defaults.texture,'all');
 assert.equal(defaults.category,'all');
});
