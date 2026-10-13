// Explicit owner-private Qwen 1.5B host bootstrap; defaults OFF and loopback only.
// No model download, no public listener, no deployment or billing mutations.
import {spawn} from "node:child_process";
import {createLocalChatAdapter} from "../hercules-models/local-chat.mjs";
import {listenModelPlaneService} from "../hercules-models/service.mjs";
import {
  inspectQwen15LocalHost,makeQwen15PrivateLaunchPlan,probeQwen15EngineIdentity
} from "../hercules-models/qwen15-owner-host.mjs";

if(process.env.HERCULES_QWEN15_PRIVATE_TRIAL!=="true"){
  process.stderr.write("owner_private_trial_disabled\n");
  process.exit(2);
}
const modelPath=process.env.HERCULES_QWEN15_MODEL_FILE;
const engineBinary=process.env.HERCULES_QWEN15_LLAMA_SERVER;
const token=process.env.HERCULES_MODEL_TOKEN;
let plan;
try{
  const hostEvidence=await inspectQwen15LocalHost({modelPath,engineBinary});
  plan=makeQwen15PrivateLaunchPlan({
    enabled:true,token,modelPath,engineBinary,hostEvidence
  });
}catch{
  process.stderr.write("owner_host_preflight_failed\n");
  process.exit(2);
}
const server=spawn(plan.engineBinary,plan.args,{
  shell:false,stdio:["ignore","ignore","ignore"],
  env:{PATH:process.env.PATH||"/usr/bin:/bin",
    LD_LIBRARY_PATH:process.env.LD_LIBRARY_PATH||""}
});
let exiting=false;
let control=null;
async function shutDown(){
  if(exiting)return;
  exiting=true;
  if(control)await new Promise(resolve=>control.close(resolve));
  if(server.exitCode===null && !server.killed)server.kill("SIGTERM");
}
process.on("SIGTERM",()=>{void shutDown().then(()=>process.exit(0));});
process.on("SIGINT",()=>{void shutDown().then(()=>process.exit(0));});
server.once("error",()=>{void shutDown().then(()=>process.exit(1));});
server.once("exit",()=>{
  if(!exiting)void shutDown().then(()=>process.exit(1));
});
let ready=false;
for(let i=0;i<90;i++){
  if(exiting||server.exitCode!==null)break;
  try{
    if(await probeQwen15EngineIdentity()){ready=true;break;}
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,1000));
}
if(!ready){
  await shutDown();
  process.stderr.write("private_model_unavailable\n");
  process.exit(1);
}
const chatAdapter=createLocalChatAdapter({
  enabled:true,endpoint:"http://127.0.0.1:18776",
  model:plan.modelAlias,protocol:plan.localChatProtocol
});
control=listenModelPlaneService({
  models:[],token,chatAdapter,
  host:"127.0.0.1",port:plan.controlPort
});
process.stdout.write(JSON.stringify({
  ok:true,privateTrial:true,host:"127.0.0.1",
  modelAlias:plan.modelAlias,productionInferenceVerified:false,
  publicReleaseApproved:false,paidCommerceEnabled:false
})+"\n");
