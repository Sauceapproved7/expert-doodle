function clean(value){return String(value??'').trim();}

function assertControlled(adapter){
  if(!adapter||!clean(adapter.provider)||typeof adapter.publish!=='function'||adapter.credentialsEmbedded!==false||adapter.spendAllowed!==false||adapter.automaticMutation!==false){
    throw new Error('provider_adapter_not_controlled');
  }
}

export function createRuntimeConnectorMap(adapters=[]){
  const map={};
  for(const adapter of adapters){
    assertControlled(adapter);
    const provider=clean(adapter.provider);
    if(Object.hasOwn(map,provider)) throw new Error('provider_already_registered');
    map[provider]=adapter.publish;
  }
  return Object.freeze(map);
}
