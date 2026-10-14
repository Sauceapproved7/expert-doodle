// Hercules Search: a provider-independent input resolver. No API key or tracking proxy.
const BLOCKED_SCHEME=/^[a-z][a-z\d+.-]*:/i;
export function resolveHerculesInput(value, provider="google"){
 if(!["google","duckduckgo"].includes(provider))throw new Error("unsupported search provider");
 const input=String(value??"").trim();
 if(!input)throw new Error("empty search");
 if(/^https?:\/\//i.test(input)){
   let url;
   try{url=new URL(input)}catch{throw new Error("invalid URL")}
   if(url.username||url.password)throw new Error("unsupported URL credentials");
   return url.href;
 }
 if(BLOCKED_SCHEME.test(input))throw new Error("unsupported URL scheme");
 if(/^(?:localhost|(?:[a-z\d-]+\.)+[a-z]{2,})(?::\d+)?(?:[/?#][^\s]*)?$/i.test(input)){
   const url=new URL("https://"+input);
   return url.href;
 }
 return (provider==="duckduckgo"?"https://duckduckgo.com/?q=":"https://www.google.com/search?q=")+encodeURIComponent(input);
}
