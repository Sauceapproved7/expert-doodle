/** No browser credentials, no report downloads, no customer-generated HTML. */
const list=document.getElementById("report-list"),status=document.getElementById("vault-status");
async function load(){
 try{
  const response=await fetch("/api/customer/reports",{credentials:"same-origin",cache:"no-store"});
  if(response.status===503){status.textContent="Report vault is not yet open. Nothing was released.";return}
  if(response.status===401){status.textContent="A verified customer session is required. Reports are private.";return}
  if(!response.ok){status.textContent="Private report metadata is unavailable.";return}
  const data=await response.json();
  if(!Array.isArray(data.reports)||data.deliveryAuthorized!==false||data.reportContentVisible!==false){
   status.textContent="Private report validation failed.";return;
  }
  list.replaceChildren();
  if(!data.reports.length){
   const p=document.createElement("p");p.className="v-muted";p.textContent="No report records were found for this account.";list.append(p);
  }
  for(const row of data.reports.slice(0,25)){
   if(row.deliveryState!=="withheld")continue;
   const item=document.createElement("div"),name=document.createElement("strong"),date=document.createElement("span");
   item.className="v-record";name.textContent="Withheld diagnostic";date.textContent="Created: "+new Date(row.createdAt).toLocaleString();
   item.append(name,date);list.append(item);
  }
  status.textContent="Report metadata only. Findings and downloads remain withheld.";
 }catch{status.textContent="Private report records could not be loaded."}
}
load();
