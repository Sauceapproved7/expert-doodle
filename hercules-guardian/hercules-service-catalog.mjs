import {createWatchtowerRegistry} from "./watchtower-registry.mjs";

const SERVICES=Object.freeze([
 ["studio","service"],
 ["forge","service"],
 ["deploy","control-plane"],
 ["cleaner","device-service"],
 ["runtime","control-plane"]
]);

export function createHerculesGuardianCatalog({baselines={},observers={}}={}){
 const services=SERVICES.map(([id,scope])=>{
  const baseline=baselines[id];
  if(!baseline||typeof baseline!=="object")throw new Error(id+" baseline is required");
  const observe=observers[id];
  if(typeof observe!=="function")throw new Error(id+" observer is required");
  return {id,scope,baseline,observe};
 });
 return createWatchtowerRegistry(services);
}
