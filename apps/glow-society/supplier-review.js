(() => {
  'use strict';
  // Human review PREPARATION only. This module can never issue seller rights or approval.
  const REQUIREMENTS=Object.freeze([
    Object.freeze({id:'supplier_identity',label:'Supplier identity and authoritative source',question:'Is an independent supplier identity and ownership verification still needed?'}),
    Object.freeze({id:'resale_rights',label:'Distribution and resale authorization',question:'Has the seller supplied a license or direct written authorization for independent review?'}),
    Object.freeze({id:'media_rights',label:'Product photos and creative rights',question:'Are photo, swatch, video and brand-mark usage rights documented for review?'}),
    Object.freeze({id:'product_compliance',label:'Product labeling and claims',question:'Are ingredient, cosmetic claim and applicable sales requirements documented for review?'}),
    Object.freeze({id:'feed_freshness',label:'Live catalog update provenance',question:'Is there a reliable source for updating product data and availability?'}),
  ]);
  const statuses=Object.freeze([
    Object.freeze({value:'not_provided',label:'Evidence not supplied'}),
    Object.freeze({value:'claimed_unverified',label:'Evidence claimed (unverified)'}),
    Object.freeze({value:'needs_review',label:'Conflict / needs review'}),
  ]);
  const knownStatus=new Set(statuses.map(x=>x.value));
  const requirementIds=new Set(REQUIREMENTS.map(x=>x.id));
  function create(candidates){
    const rows=Array.isArray(candidates)?candidates.filter(x=>x&&typeof x.sku==='string'&&x.provenance==='unverified'&&x.publication==='blocked'):[];
    const ids=new Set(),items=[];
    for(const row of rows.slice(0,30)){
      const id=row.sku.toUpperCase();
      if(ids.has(id))continue;
      ids.add(id);
      items.push(Object.freeze({sku:row.sku,brand:row.brand,name:row.name}));
    }
    const entries=new Map(items.map(x=>[x.sku.toUpperCase(),
      new Map(REQUIREMENTS.map(req=>[req.id,'not_provided']))]));
    function set(sku,requirement,status){
      if(typeof sku!=='string'||!requirementIds.has(requirement)||!knownStatus.has(status))return false;
      const row=entries.get(sku.toUpperCase());
      if(!row)return false;
      row.set(requirement,status);
      return true;
    }
    function apply(changes){
      if(!Array.isArray(changes)||changes.length!==items.length*REQUIREMENTS.length)return false;
      const seen=new Set();
      for(const change of changes){
        if(!change||typeof change.sku!=='string'||!requirementIds.has(change.requirement)||
           !knownStatus.has(change.status))return false;
        const sku=change.sku.toUpperCase(),key=sku+'|'+change.requirement;
        const row=entries.get(sku);
        if(!row||!items.some(x=>x.sku===change.sku)||seen.has(key))return false;
        seen.add(key);
      }
      if(seen.size!==items.length*REQUIREMENTS.length)return false;
      // The batch is validated completely before any existing state changes.
      for(const change of changes)entries.get(change.sku.toUpperCase()).set(change.requirement,change.status);
      return true;
    }
    function reset(){
      for(const row of entries.values())for(const req of REQUIREMENTS)row.set(req.id,'not_provided');
    }
    function snapshot(){
      return Object.freeze({
        schemaVersion:1,scope:'client-side-preparatory-review',
        independentVerification:'not_performed',ownerApproval:'not_granted',
        approved:0,published:0,releaseEligible:false,
        records:Object.freeze(items.map(x=>Object.freeze({
          sku:x.sku,brand:x.brand,name:x.name,
          requirements:Object.freeze(Object.fromEntries(REQUIREMENTS.map(req=>[
            req.id,entries.get(x.sku.toUpperCase()).get(req.id)]))),
          verdict:'unverified_not_for_sale',
        }))),
      });
    }
    return Object.freeze({set,apply,reset,snapshot});
  }
  Object.defineProperty(window,'GlowSupplierReview',{value:Object.freeze({REQUIREMENTS,statuses,create}),writable:false,configurable:false});
})();