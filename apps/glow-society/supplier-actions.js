(() => {
'use strict';
const labels=Object.freeze({supplier_identity:'Supplier identity and source',resale_rights:'Resale authorization',media_rights:'Creative and image rights',product_compliance:'Product labeling and claims',feed_freshness:'Feed freshness and stock source'});
const priorities=Object.freeze({needs_review:1,not_provided:2,claimed_unverified:3});
const actions=Object.freeze({needs_review:'Resolve disputed evidence independently',not_provided:'Request missing supporting documents',claimed_unverified:'Independently verify claimed evidence'});
function prepare(packet){
  if(!packet||packet.schemaVersion!==1||packet.scope!=='client-side-preparatory-review'||
    packet.independentVerification!=='not_performed'||packet.ownerApproval!=='not_granted'||
    packet.releaseEligible!==false||packet.approved!==0||packet.published!==0||!Array.isArray(packet.records))
    return null;
  const queue=[];
  for(const record of packet.records.slice(0,30)){
    if(!record||record.verdict!=='unverified_not_for_sale'||typeof record.sku!=='string'||typeof record.name!=='string'||typeof record.brand!=='string'||!record.requirements)return null;
    for(const key of Object.keys(labels)){
      const status=record.requirements[key];
      if(!Object.hasOwn(priorities,status))return null;
      queue.push(Object.freeze({sku:record.sku,brand:record.brand,name:record.name,requirement:key,requirementLabel:labels[key],status,action:actions[status],priority:priorities[status],verified:false}));
    }
  }
  queue.sort((a,b)=>a.priority-b.priority||a.sku.localeCompare(b.sku)||a.requirement.localeCompare(b.requirement));
  return Object.freeze({schemaVersion:1,scope:'offline-unverified-action-plan',sourceApproval:'not_granted',
    verified:0,approved:0,published:0,releaseEligible:false,
    tasks:Object.freeze(queue)});
}
Object.defineProperty(window,'GlowSupplierActions',{value:Object.freeze({prepare}),writable:false,configurable:false});
})();