export function createWatchtowerScheduler({runCycle,intervalMs=60000}={}){
 if(typeof runCycle!=="function")throw new Error("runCycle is required");
 if(!Number.isSafeInteger(intervalMs)||intervalMs<1000)throw new Error("intervalMs must be at least 1000");
 let running=false,timer=null,stopped=true;
 async function tick(){
  if(running)return Object.freeze({status:"SKIPPED_OVERLAP",executionAuthority:false});
  running=true;
  try{return await runCycle()}
  finally{running=false}
 }
 function start(){
  if(!stopped)return;
  stopped=false;
  void tick();
  timer=setInterval(()=>void tick(),intervalMs);
 }
 function stop(){
  stopped=true;
  if(timer)clearInterval(timer);
  timer=null;
 }
 return Object.freeze({tick,start,stop,get running(){return running},get stopped(){return stopped}});
}
