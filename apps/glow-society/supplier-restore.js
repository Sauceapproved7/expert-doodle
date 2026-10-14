(() => {
  'use strict';
  // Offline restoration of unverified choices only. No authority, network access or persistence.
  const MAX_BYTES=65536;
  const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
  const exactKeys=(obj,keys)=>!!obj&&typeof obj==='object'&&!Array.isArray(obj)&&
    Object.keys(obj).length===keys.length&&Object.keys(obj).every(k=>keys.includes(k));
  const packetKeys=['schemaVersion','scope','independentVerification','ownerApproval',
    'approved','published','releaseEligible','records'];
  const rowKeys=['sku','brand','name','requirements','verdict'];
  const validStatuses=new Set(['not_provided','claimed_unverified','needs_review']);
  const requiredIds=['supplier_identity','resale_rights','media_rights','product_compliance','feed_freshness'];
  function fail(message){return Object.freeze({error:message,changes:Object.freeze([])});}
  function validate(value,baseline){
    if(!baseline||!exactKeys(baseline,packetKeys)||baseline.scope!=='client-side-preparatory-review'||
      baseline.independentVerification!=='not_performed'||baseline.ownerApproval!=='not_granted'||
      baseline.approved!==0||baseline.published!==0||baseline.releaseEligible!==false||
      !Array.isArray(baseline.records)||baseline.records.length<1||baseline.records.length>30)
      return fail('Load a valid supplier feed before restoring review choices');
    if(!exactKeys(value,packetKeys)||value.schemaVersion!==1||
      value.scope!=='client-side-preparatory-review'||value.independentVerification!=='not_performed'||
      value.ownerApproval!=='not_granted'||value.approved!==0||
      value.published!==0||value.releaseEligible!==false||
      !Array.isArray(value.records)||value.records.length!==baseline.records.length)
      return fail('Review packet is not the expected unverified, unreleased format');
    const expected=new Map();
    for(const rec of baseline.records){
      if(!exactKeys(rec,rowKeys)||typeof rec.sku!=='string')return fail('Current feed scope is invalid');
      expected.set(rec.sku.toUpperCase(),rec);
    }
    if(expected.size!==baseline.records.length)return fail('Current feed has duplicate identifiers');
    const seen=new Set(),changes=[];
    for(const rec of value.records){
      if(!exactKeys(rec,rowKeys)||typeof rec.sku!=='string'||typeof rec.name!=='string'||
        typeof rec.brand!=='string'||rec.verdict!=='unverified_not_for_sale')
        return fail('Packet contains unknown or unauthorized product fields');
      const key=rec.sku.toUpperCase(),reference=expected.get(key);
      if(!reference||seen.has(key)||rec.sku!==reference.sku||rec.brand!==reference.brand||rec.name!==reference.name)
        return fail('Packet identifiers or product names do not match the loaded feed');
      seen.add(key);
      if(!exactKeys(rec.requirements,requiredIds))return fail('Packet evidence checklist has unexpected fields');
      for(const id of requiredIds){
        if(!own(rec.requirements,id)||!validStatuses.has(rec.requirements[id]))
          return fail('Packet contains an unsupported evidence or approval status');
        changes.push(Object.freeze({sku:rec.sku,requirement:id,status:rec.requirements[id]}));
      }
    }
    if(seen.size!==expected.size)return fail('Packet does not cover every candidate in the loaded feed');
    return Object.freeze({error:null,changes:Object.freeze(changes)});
  }
  function parse(text,baseline){
    if(typeof text!=='string'||new TextEncoder().encode(text).byteLength>MAX_BYTES)
      return fail('Choose a UTF-8 JSON review packet no larger than 64 KiB');
    try{return validate(JSON.parse(text),baseline);}
    catch{return fail('Review packet is invalid JSON');}
  }
  Object.defineProperty(window,'GlowSupplierRestore',{
    value:Object.freeze({parse,validate,maxBytes:MAX_BYTES}),writable:false,configurable:false
  });
})();