(() => {
  'use strict';
  // A human-observation checklist, not an automated assessment or personal profile.
  const scenarios=Object.freeze([
    Object.freeze({id:'face-deep-daylight',mode:'face',label:'Deep/rich complexion · daylight',guidance:'Inspect lip and cheek overlay edges and whether colors remain visible'}),
    Object.freeze({id:'face-deep-indoor',mode:'face',label:'Deep/rich complexion · indoor lighting',guidance:'Check tracking stability and visible overlay contrast'}),
    Object.freeze({id:'face-varied-light',mode:'face',label:'Other complexion · mixed lighting',guidance:'Check whether face overlays drift when lighting changes'}),
    Object.freeze({id:'face-motion',mode:'face',label:'Face movement and side angles',guidance:'Check alignment while turning or smiling; stop if tracking becomes uncomfortable'}),
    Object.freeze({id:'hand-deep-daylight',mode:'hand',label:'Deeper skin tone · nail preview · daylight',guidance:'Check position over fingers and contrast against the hand'}),
    Object.freeze({id:'hand-motion',mode:'hand',label:'Hand movement · indoor lighting',guidance:'Check whether nail concepts follow finger movement without unexpected drift'})
  ]);
  const allowed=new Set(['not-tested','looks-aligned','needs-review']);
  function create(){
    const results=new Map(scenarios.map(s=>[s.id,'not-tested']));
    function setResult(id,result){
      if(!scenarios.some(s=>s.id===id)||!allowed.has(result))return false;
      results.set(id,result);
      return true;
    }
    function clear(){for(const s of scenarios)results.set(s.id,'not-tested')}
    function snapshot(){
      return Object.freeze({
        schema:1,
        status:'self-reported-unverified',
        accuracyCertified:false,
        scenarios:scenarios.map(s=>Object.freeze({
          id:s.id,mode:s.mode,label:s.label,result:results.get(s.id)
        }))
      });
    }
    return Object.freeze({setResult,clear,snapshot});
  }
  Object.defineProperty(window,'GlowValidationKit',{value:Object.freeze({scenarios,create}),writable:false,configurable:false});
})();