const $=id=>document.getElementById(id);
const status=msg=>$("status").textContent=msg;
async function currentTab(){const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab?.id||!tab.url)throw Error("No active web tab");return tab}
$("share").onclick=async()=>{
  try{
    const tab=await currentTab();
    const u=new URL(tab.url);
    if(u.protocol!=="https:")throw Error("Only HTTPS sites can be shared");
    const origin=u.origin;
    const granted=await chrome.permissions.request({origins:[origin+"/*"]});
    if(!granted)throw Error("Site permission was not granted");
    const pairToken=$("pair").value.trim();
    if(!pairToken)throw Error("Pairing token required");
    const reply=await chrome.runtime.sendMessage({action:"share_current_tab",tabId:tab.id,origin,title:tab.title||"",pairToken});
    $("pair").value="";
    status(reply?.ok?"Connected: "+origin:(reply?.error||"Connection failed"));
  }catch(e){status(e.message||String(e))}
};
$("disconnect").onclick=async()=>{
  const reply=await chrome.runtime.sendMessage({action:"disconnect"});
  status(reply?.ok?"Disconnected":(reply?.error||"Disconnect failed"));
};