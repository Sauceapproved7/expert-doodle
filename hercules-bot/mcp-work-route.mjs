const CREDENTIAL_FIELDS=new Set(["token","password","secret","apiKey","api_key","authorization","serviceRole","service_role"]);
export function normalizeBotWorkCommand(input={}){
 for(const key of Object.keys(input||{})) if(CREDENTIAL_FIELDS.has(key)) throw new Error("credential field rejected");
 const action=String(input.action||"");
 if(action==="bot.browser.navigate"||action==="bot.browser.scrape"){
  let u; try{u=new URL(String(input.url||""));}catch{throw new Error("invalid browser url")}
  if(!["http:","https:"].includes(u.protocol))throw new Error("invalid browser url");
  return {action,url:u.toString()};
 }
 if(action==="bot.deploy.status")return {action};
 throw new Error("unsupported bot work action");
}
