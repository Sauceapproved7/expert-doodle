import {createCanonicalGuardianCatalog} from "./canonical-guardian-catalog.mjs";
import {runWatchtowerCycle} from "./watchtower-registry.mjs";
import {createWatchtowerScheduler} from "./watchtower-scheduler.mjs";

export async function createCanonicalWatchtowerRuntime({
 catalogFactory=createCanonicalGuardianCatalog,
 catalogInput={},
 intervalMs=60000
}={}){
 if(typeof catalogFactory!=="function")throw new Error("Guardian catalog factory is required");
 const catalog=await catalogFactory(catalogInput);
 let latest=null;
 let incidentFingerprints=Object.freeze([]);

 const runCycle=async()=>{
  const cycle=await runWatchtowerCycle(catalog,{knownIncidentFingerprints:incidentFingerprints});
  incidentFingerprints=Object.freeze([...cycle.incidentFingerprints]);
  latest=Object.freeze({
   status:cycle.status,
   results:cycle.results,
   incidentFingerprints,
   executionAuthority:false
  });
  return latest;
 };

 const scheduler=createWatchtowerScheduler({runCycle,intervalMs});

 async function readStatus(){
  if(!latest)throw new Error("Guardian Watchtower cycle has not completed");
  return latest;
 }

 return Object.freeze({
  tick:scheduler.tick,
  start:scheduler.start,
  stop:scheduler.stop,
  readStatus,
  get running(){return scheduler.running},
  get stopped(){return scheduler.stopped},
  executionAuthority:false
 });
}
