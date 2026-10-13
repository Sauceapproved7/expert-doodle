/** Browser-only format preview: never submits a customer site or data to any server. */
const input=document.getElementById("preview-site-input");
const output=document.getElementById("preview-feedback");
const button=document.getElementById("preview-site-button");
function inspect(value){
 if(typeof value!=="string"||value.length>256||!value.startsWith("https://"))throw Error("Enter a public HTTPS website address.");
 let url;
 try{url=new URL(value)}catch{throw Error("Enter a valid HTTPS website address.")}
 if(url.protocol!=="https:"||url.username||url.password||url.port||url.search||url.hash||
   url.pathname!=="/"||!url.hostname.includes(".")||
   !/^[a-z0-9.-]+$/i.test(url.hostname)||
   /(^|\.)(localhost|local|internal|test|invalid|onion)$/i.test(url.hostname)||
   url.hostname.split(".").some(x=>!x||x.length>63||x.startsWith("-")||x.endsWith("-"))||
   /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)){
  throw Error("Use a public HTTPS domain without a path, port, password or query.");
 }
 return url.origin;
}
function preview(){
 try{
  const origin=inspect(input.value.trim());
  output.textContent="Address format recognized: "+origin+". Format check only — ownership and payment are not verified. Nothing was submitted.";
 }catch(error){output.textContent=error.message+" Nothing was submitted."}
}
button.addEventListener("click",preview);
input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();preview()}});
