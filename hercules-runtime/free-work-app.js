const get=id=>document.getElementById(id);
const token=get("token"),status=get("status"),result=get("result"),history=get("history");
function updateStatus(message){status.textContent=message;}
async function api(path,method="GET",body){
  if(!token.value.trim())throw new Error("Enter the owner token first.");
  const response=await fetch(path,{method,
    headers:{authorization:"Bearer "+token.value.trim(),...(body?{"content-type":"application/json"}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
  let data;try{data=await response.json();}catch{throw new Error("Unexpected server response.");}
  if(!response.ok)throw new Error(data.error||"Request failed");
  return data;
}
async function refresh(){
  const {tasks}=await api("/api/tasks");
  history.replaceChildren();
  if(!tasks.length){
    const li=document.createElement("li");li.textContent="No jobs yet.";history.append(li);return;
  }
  tasks.forEach(task=>{
    const li=document.createElement("li");
    const label=document.createElement("strong");label.textContent=task.kind.toUpperCase()+" · "+task.status;
    const small=document.createElement("small");small.textContent=task.prompt;
    const button=document.createElement("button");button.type="button";button.className="open";button.textContent="View";
    button.addEventListener("click",async()=>{
      try{const detail=await api("/api/tasks/"+encodeURIComponent(task.id));
        result.textContent=detail.task.output||"No output: "+detail.task.status;
        updateStatus("Opened "+task.kind+" job.");
      }catch(error){updateStatus(error.message);}
    });
    li.append(label,small,button);history.append(li);
  });
}
get("run").addEventListener("click",async()=>{
  get("run").disabled=true;
  try{
    updateStatus("Submitting job...");
    const input={kind:get("kind").value,prompt:get("prompt").value,context:get("context").value};
    const created=await api("/api/tasks","POST",input);
    updateStatus("Running "+input.kind+"...");
    const executed=await api("/api/tasks/"+created.task.id+"/run","POST",{});
    result.textContent=executed.task.output;
    updateStatus("Completed using "+executed.task.engine+".");
    await refresh();
  }catch(error){updateStatus(error.message);try{await refresh();}catch{}}
  finally{get("run").disabled=false;}
});
get("refresh").addEventListener("click",async()=>{try{await refresh();updateStatus("Job history refreshed.");}catch(error){updateStatus(error.message);}});
