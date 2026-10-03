function clean(value){return String(value??'').trim();}

function validateAdapter(adapter){
  if(!adapter||!clean(adapter.provider)||typeof adapter.publish!=='function'||adapter.credentialsEmbedded!==false||adapter.spendAllowed!==false||adapter.automaticMutation!==false){
    throw new Error('provider_adapter_not_controlled');
  }
}

export function createProviderRegistry(adapters=[]){
  const entries=new Map();
  for(const adapter of adapters){
    validateAdapter(adapter);
    const provider=clean(adapter.provider);
    if(entries.has(provider)) throw new Error('provider_already_registered');
    entries.set(provider,adapter.publish);
  }
  return Object.freeze({
    providers(){return Object.freeze([...entries.keys()].sort());},
    resolve(provider){
      const publish=entries.get(clean(provider));
      if(typeof publish!=='function') throw new Error('provider_not_registered');
      return publish;
    }
  });
}
