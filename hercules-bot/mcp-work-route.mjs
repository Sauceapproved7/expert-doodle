const CREDENTIAL_FIELDS=new Set(["token","password","secret","apiKey","api_key","authorization","serviceRole","service_role"]);
const SMALLZ_BROWSER_VERIFICATION_URL="https://smallz-hercules.onrender.com/health";
export function normalizeBotWorkCommand(input={}){
 for(const key of Object.keys(input||{})) if(CREDENTIAL_FIELDS.has(key)) throw new Error("credential field rejected");
 const action=String(input.action||"");
 if(action==="smallz.validate.shopify"){
  const api=String(input.api||"");
  if(api!=="admin") throw new Error("unsupported Shopify validator");
  const code=String(input.code||"");
  if(!code.trim()) throw new Error("Shopify code required");
  const version=input.version==null?"":String(input.version);
  if(version&&!/^\\d{4}-(01|04|07|10)$/.test(version)) throw new Error("invalid Shopify API version");
  return {action,api,code,...(version?{version}:{}),validationRequired:true,validator:"shopify-ai-toolkit"};
 }
 if(action==="smallz.verify.browser"){
  if(Object.prototype.hasOwnProperty.call(input,"url")) throw new Error("verification target is fixed");
  return {action,url:SMALLZ_BROWSER_VERIFICATION_URL,verificationOnly:true};
 }
 if(action==="bot.browser.navigate"||action==="bot.browser.scrape"){
  let u; try{u=new URL(String(input.url||""));}catch{throw new Error("invalid browser url")}
  if(!["http:","https:"].includes(u.protocol))throw new Error("invalid browser url");
  return {action,url:u.toString()};
 }
 if(action==="bot.deploy.status")return {action};
 throw new Error("unsupported bot work action");
}
