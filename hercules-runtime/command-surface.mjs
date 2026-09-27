import {createHash} from "node:crypto";
const ROUTES=Object.freeze({
  "forge.build":"hercules-forge",
  "base.blueprint":"hercules-base",
  "chat.run":"hercules-chat",
  "recovery.assess":"hercules-recovery",
  "recovery.route":"hercules-recovery",
  "video.render":"hercules-video",
  "deploy.release":"hercules-deploy"
});
const SHA=/^[a-f0-9]{64}$/i;
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v}
function digest(v){return createHash("sha256").update(JSON.stringify(stable(v))).digest("hex")}
export function createCommandRequest(input={}){
 const intentId=String(input.intentId??"").trim();
 const capability=String(input.capability??"").trim();
 if(!intentId)throw new Error("intentId required");
 if(!(capability in ROUTES))throw new Error("unsupported capability");
 const body=stable({schema:"hercules.command.request.v1",intentId,capability,payload:input.payload??{},executionAuthority:false});
 return Object.freeze({...body,commandSha256:digest(body)});
}
export function verifyCommandRequest(command={}){
 const {commandSha256,...body}=command;
 if(!SHA.test(commandSha256??""))return Object.freeze({valid:false,reason:"INVALID_DIGEST"});
 const calculatedSha256=digest(body),valid=calculatedSha256===commandSha256;
 return Object.freeze({valid,reason:valid?"VERIFIED":"DIGEST_MISMATCH",calculatedSha256});
}
export function routeCommand(command={}){
 if(!verifyCommandRequest(command).valid)throw new Error("invalid command request");
 const route=ROUTES[command.capability];
 if(!route)throw new Error("unsupported capability");
 return Object.freeze({schema:"hercules.command.route.v1",intentId:command.intentId,capability:command.capability,route,commandSha256:command.commandSha256,executionAuthority:false});
}
export function listCommandCapabilities(){return Object.freeze(Object.keys(ROUTES).sort())}
