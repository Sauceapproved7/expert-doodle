(() => {
'use strict';
// Deterministic discovery ranking of fictional concepts; not shade matching or face analysis.
const depth=new Set(['all','deep','tan','medium','light']);
const tone=new Set(['all','warm','cool','neutral','olive']);
const texture=new Set(['all','3b','4a','4b','4c','braids','locs','protective']);
const category=new Set(['all','makeup','hair','nails']);
const vibe=new Set(['all','everyday','statement']);
const indicators={
 everyday:['nude','soft','natural','rose','french','neutral','everyday','coils','twist','gloss','short','curls'],
 statement:['oxblood','royal','berry','gold','bold','burgundy','chrome','emerald','plum','copper','gemstone','onyx','foil']
};
function normalize(p){
 const o=p||{},valid=(value,options)=>options.has(value)?value:'all';
 return Object.freeze({depth:valid(o.depth,depth),tone:valid(o.tone,tone),
 texture:valid(o.texture,texture),category:valid(o.category,category),vibe:valid(o.vibe,vibe)});
}
function recommend(catalog,settings){
 const p=normalize(settings),results=[];
 if(!Array.isArray(catalog))return results;
 for(const item of catalog){
   if(!item||typeof item.id!=='string'||!['makeup','hair','nails'].includes(item.category)||!Array.isArray(item.tags))continue;
   if(p.category!=='all'&&p.category!==item.category)continue;
   const notes=[],tags=item.tags;
   if(item.category==='makeup'){
     if(p.depth!=='all'&&!tags.includes(p.depth))continue;
     if(p.tone!=='all'&&!tags.includes(p.tone))continue;
     if(p.depth!=='all')notes.push(p.depth+'-depth inspiration tag');
     if(p.tone!=='all')notes.push(p.tone+' undertone inspiration tag');
   }
   if(item.category==='hair'){
     if(p.texture!=='all'&&!tags.includes(p.texture))continue;
     if(p.texture!=='all')notes.push(p.texture.toUpperCase()+' hair inspiration tag');
   }
   const hay=(item.name+' '+item.desc+' '+tags.join(' ')).toLowerCase();
   let score=notes.length*8;
   if(p.vibe!=='all'){
     const count=indicators[p.vibe].filter(word=>hay.includes(word)).length;
     score+=count*3;
     if(count)notes.push(p.vibe+' style keyword');
   }
   if(item.category==='nails')notes.push('nail design inspiration');
   if(!notes.length)notes.push('catalog inspiration');
   results.push({id:item.id,category:item.category,region:item.region,score,reason:notes.join(' · ')});
 }
 results.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 // An all-category recommendation includes makeup, hair and nails when available.
 const limit=p.category==='all'?5:4,cap=p.category==='all'?1:2;
 const chosen=[],counts=new Map();
 for(const suggestion of results){
   if(chosen.length>=limit)break;
   const count=counts.get(suggestion.region)||0;
   if(count>=cap)continue;
   chosen.push(Object.freeze({id:suggestion.id,reason:suggestion.reason}));
   counts.set(suggestion.region,count+1);
 }
 return Object.freeze(chosen);
}
Object.defineProperty(window,'GlowBeautyMatch',{value:Object.freeze({normalize,recommend}),writable:false,configurable:false});
})();