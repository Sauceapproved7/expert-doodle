(() => {
  'use strict';
  // Only schema validation; this never performs network requests or establishes seller authority.
  const MAX_RECORDS=30,MAX_BYTES=65536;
  const CATEGORIES=Object.freeze(['makeup','hair','nails']);
  const TAGS=new Set(['deep','tan','medium','light','warm','cool','neutral','olive','3b','4a','4b','4c','braids','locs','protective','coils','curls','twists','short','french','chrome','gloss']);
  const RECORD_KEYS=new Set(['sku','name','brand','category','sourceUrl','tags']);
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  function safeText(value,limit){
    return typeof value==='string'&&value.length>=2&&value.length<=limit&&value.trim()===value&&
      !/[\u0000-\u001f\u007f<>]/.test(value);
  }
  function validSource(value){
    if(typeof value!=='string'||value.length>350||!/^https:\/\//i.test(value))return false;
    try{
      const url=new URL(value),host=url.hostname.toLowerCase();
      if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)return false;
      if(!host.includes('.')||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal'))return false;
      if(/^\d+\.\d+\.\d+\.\d+$/.test(host)||host.startsWith('['))return false;
      return true;
    }catch{return false}
  }
  function normalizeRecord(item,seen){
    if(!item||typeof item!=='object'||Array.isArray(item))return {reason:'Record must be an object'};
    if(Object.keys(item).some(key=>!RECORD_KEYS.has(key)))return {reason:'Unsupported field (including any price, stock, image or approval claim)'};
    if(typeof item.sku!=='string'||!/^[a-z0-9][a-z0-9_-]{1,39}$/i.test(item.sku))return {reason:'Invalid SKU identifier'};
    const key=item.sku.toUpperCase();
    if(seen.has(key))return {reason:'Duplicate SKU identifier'};
    if(!safeText(item.name,100)||!safeText(item.brand,80))return {reason:'Product name or brand is missing or malformed'};
    if(!CATEGORIES.includes(item.category))return {reason:'Invalid category'};
    if(!validSource(item.sourceUrl))return {reason:'Invalid HTTPS source reference'};
    if(item.tags!==undefined&&(!Array.isArray(item.tags)||item.tags.length>8||item.tags.some(t=>typeof t!=='string'||!TAGS.has(t))||new Set(item.tags).size!==item.tags.length))
      return {reason:'Invalid or repeated editorial tags'};
    seen.add(key);
    return {record:Object.freeze({sku:item.sku,name:item.name,brand:item.brand,
      category:item.category,sourceUrl:item.sourceUrl,tags:Object.freeze([...(item.tags||[])]),
      provenance:'unverified',publication:'blocked'})};
  }
  function validate(feed){
    if(!feed||typeof feed!=='object'||Array.isArray(feed)||feed.schemaVersion!==1||
      !Array.isArray(feed.products)||Object.keys(feed).some(k=>k!=='schemaVersion'&&k!=='products')){
      return Object.freeze({error:'Expected a schemaVersion 1 document with a products array',items:[],rejected:[],approved:0});
    }
    if(feed.products.length>MAX_RECORDS)return Object.freeze({error:'Feed exceeds the 30-record local review limit',items:[],rejected:[],approved:0});
    const seen=new Set(),items=[],rejected=[];
    feed.products.forEach((entry,index)=>{
      const result=normalizeRecord(entry,seen);
      if(result.record)items.push(result.record);
      else rejected.push(Object.freeze({row:index+1,reason:result.reason}));
    });
    return Object.freeze({error:null,items:Object.freeze(items),rejected:Object.freeze(rejected),approved:0});
  }
  function parse(text){
    if(typeof text!=='string'||new TextEncoder().encode(text).byteLength>MAX_BYTES)
      return Object.freeze({error:'File must be UTF-8 JSON no larger than 64 KiB',items:[],rejected:[],approved:0});
    try{return validate(JSON.parse(text))}
    catch{return Object.freeze({error:'Invalid JSON document',items:[],rejected:[],approved:0})}
  }
  const sample=Object.freeze({schemaVersion:1,products:[
    {sku:'EXAMPLE-LIP-01',name:'Example Chocolate Lip',brand:'Fictional Demo Brand',category:'makeup',sourceUrl:'https://example.com/not-a-real-product',tags:['deep','warm']},
    {sku:'EXAMPLE-HAIR-01',name:'Example 4C Coil Style',brand:'Fictional Demo Brand',category:'hair',sourceUrl:'https://example.com/not-a-real-style',tags:['4c','coils']}
  ]});
  Object.defineProperty(window,'GlowCatalogIntake',{value:Object.freeze({parse,validate,sample,maxBytes:MAX_BYTES}),writable:false,configurable:false});
})();