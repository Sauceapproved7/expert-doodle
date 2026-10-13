import {randomBytes} from "node:crypto";
import {HerculesEmbeddedCoreNeuralV03} from "./embedded-core-neural-v0.3.mjs";
import {createServer, EXPERIMENTAL_MODEL_ID} from "./experimental-chat-bridge.mjs";

const host=process.env.HERCULES_EXP_CHAT_HOST??"127.0.0.1";
const port=Number(process.env.PORT??process.env.HERCULES_EXP_CHAT_PORT??38902);
if(!Number.isInteger(port) || port<1 || port>65535) throw new Error("invalid listen port");
const configured=process.env.HERCULES_EXP_CHAT_TOKEN;
if(configured!==undefined && configured.length<32) throw new Error("weak configured experimental token");
const token=configured??randomBytes(32).toString("hex");

// The original checkpoint is intentionally only an experimental, tiny neural
// next-token model. Loading it never promotes its status to production.
const candidate=await HerculesEmbeddedCoreNeuralV03.load();
const generate=async(prompt,{maxTokens})=>candidate.infer({prompt,maxTokens},{task:"general"});
const server=createServer({token,modelId:EXPERIMENTAL_MODEL_ID,generate});
server.listen(port,host,()=>{
  console.log(JSON.stringify({ok:true,service:"hercules-experimental-chat-bridge",
    host,port,model:EXPERIMENTAL_MODEL_ID,experimental:true,
    tokenSource:configured?"environment":"generated-session",
    public_release_approved:false,chat_quality_verified:false,
    production_connected:false}));
});
