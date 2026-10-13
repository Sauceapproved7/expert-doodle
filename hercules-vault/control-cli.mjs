import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {randomBytes} from "node:crypto";
import {buildVaultIndex,createVaultServer} from "./source-grounded-assistant.mjs";

if(process.env.HERCULES_VAULT_ASSISTANT_ENABLED!=="true"){
  throw new Error("Hercules Vault assistant disabled: explicit staging opt-in required");
}
// This is a deliberately SMALL local, reviewed source set, not the user's
// full private Vault and not a general knowledge or conversational model.
const SOURCE_DOCS=[
  "docs/HERCULES-MODEL-BACKEND-READINESS-V1.md",
  "docs/HERCULES-EXPERIMENTAL-CHAT-BRIDGE-V1.md",
  "docs/HERCULES-NATIVE-MODEL-LAB-V1.md",
  "docs/HERCULES-IPHONE-STATIC-PREVIEW-V1.md",
  "docs/HERCULES-IPHONE-PUBLIC-EVIDENCE-V1.md",
];
const docs=await Promise.all(SOURCE_DOCS.map(async path=>({
  path,content:await readFile(fileURLToPath(new URL("../"+path,import.meta.url)),"utf8"),
})));
const index=buildVaultIndex(docs);
const configured=process.env.HERCULES_VAULT_ASSISTANT_TOKEN;
if(configured!=null && configured.length<32)throw new Error("configured Vault token too short");
const token=configured??randomBytes(32).toString("hex");
const port=Number(process.env.PORT??38903);
if(!Number.isInteger(port)||port<=0||port>65535)throw new Error("invalid port");
const host=process.env.HERCULES_VAULT_HOST??"127.0.0.1";
const server=createVaultServer({token,index});
server.listen(port,host,()=>console.log(JSON.stringify({
  ok:true,service:"hercules-vault-source-assistant",experimental:true,
  tokenSource:configured?"environment":"generated-session",
  totalDocumentCount:docs.length,public_release_approved:false,general_chat_verified:false,
  production_connected:false
})));
