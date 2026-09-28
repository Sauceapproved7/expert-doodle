const $=id=>document.getElementById(id);
const kits={
  hero:{name:"Neighborhood Hero",description:"Choose a decision, then see another way the hero could help.",
    first:["Choice Compass","Try two decisions and compare what each changes."],second:["Courage Replay","Give the hero a second kind of brave ending."],
    controls:`<label>Hero's challenge<select id="challenge"><option>Someone feels left out</option><option>A neighbor needs help</option><option>A friend makes a mistake</option></select></label>`,
    firstControls:`<label>First choice<select id="choice"><option>Ask what they need</option><option>Offer to help together</option><option>Find a trusted grown-up</option></select></label>`,
    secondControls:`<label>Replay the choice<select id="replay"><option>Listen before acting</option><option>Invite others to help</option><option>Speak up kindly</option></select></label>`},
  director:{name:"Dream Director",description:"Make a performance, fashion, or story film with two points of view.",
    first:["Beat Board","Set a silent rhythm and give each shot room to breathe."],second:["Role Swap","Plan what the director sees and what the performer wants to show."],
    controls:`<label>Show format<select id="format"><option>Dance</option><option>Storytelling</option><option>Fashion</option><option>Magic trick</option></select></label>`,
    firstControls:`<label>Beat spacing<select id="beat-board"><option value="3">Quick cuts · 3 seconds</option><option value="5">Easy groove · 5 seconds</option><option value="8">Slow spotlight · 8 seconds</option></select></label>`,
    secondControls:`<label>Director's focus<select id="role-swap"><option>Show the whole stage</option><option>Follow the hands</option><option>Catch the expression</option></select></label>`},
  capsule:{name:"Time Capsule",description:"Pair a moment today with a reflection for later.",
    first:["Then / Now","Plan a present-day shot and a future question side by side."],second:["Privacy Check","Scan the draft for obvious contact details before saving."],
    controls:`<label>Future question<select id="then-now"><option>What made you smile today?</option><option>What did you learn to do?</option><option>What do you hope stays the same?</option></select></label>`,
    firstControls:`<label>Moment to remember<select id="moment"><option>A favorite activity</option><option>A family tradition</option><option>Something you made</option></select></label>`,
    secondControls:`<p>We check for email addresses, phone-like numbers, URLs, and common address terms. A parent must still review the whole story.</p><button class="action secondary" id="privacy-check" type="button">Check draft</button><div id="privacy-result" role="status"></div>`}
};
let active="hero",reviewedPlan=null;
const value=id=>$(id)?.value?.trim()||"";
const privacyFlags=text=>{
  const flags=[];
  if(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text))flags.push("email address");
  if(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(text))flags.push("phone-like number");
  if(/(?:https?:\/\/|www\.)\S+/i.test(text))flags.push("website link");
  if(/\b\d{1,6}\s+[a-z][\w\s]{0,36}\b(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln)\b/i.test(text))flags.push("possible street address");
  return flags;
};
function invalidate(){
  reviewedPlan=null;$("save").disabled=true;$("output").textContent="";
  $("message").textContent="Draft changed. Preview and review again before saving.";
}
function chooseKit(id){
  if(!kits[id])return;
  active=id;const kit=kits[id];
  for(const button of document.querySelectorAll(".kit"))button.setAttribute("aria-pressed",String(button.dataset.kit===id));
  $("workspace-title").textContent=kit.name;$("description").textContent=kit.description;
  $("feature-title").textContent=kit.first[0];$("feature-description").textContent=kit.first[1];
  $("feature-two-title").textContent=kit.second[0];$("feature-two-description").textContent=kit.second[1];
  $("kit-controls").innerHTML=kit.controls;$("feature-controls").innerHTML=kit.firstControls;$("feature-two-controls").innerHTML=kit.secondControls;
  $("title").value="";$("idea").value="";$("parent").checked=false;invalidate();
}
function buildPlan(){
  const title=value("title")||"Untitled family story",idea=value("idea")||"A private, parent-approved scene.";
  let shots;
  if(active==="hero"){
    const challenge=value("challenge"),choice=value("choice"),replay=value("replay");
    shots=[`1. Establish the challenge: ${challenge}.`,`2. Choice Compass: show the hero choosing to ${choice.toLowerCase()}.`,`3. Show how that choice helps.`,`Alternate ending — Courage Replay: ${replay}. Film this as a separate ending and compare the two.`];
  }else if(active==="director"){
    const seconds=Number(value("beat-board")),format=value("format"),focus=value("role-swap");
    shots=[`0–${seconds}s: Open the ${format.toLowerCase()} scene and show the space.`,`${seconds}–${seconds*2}s: Perform the main moment.`,`${seconds*2}–${seconds*3}s: End with a clear pose or closing beat.`,`Role Swap: director view — ${focus}. Performer view — choose a comfortable angle together and capture a second take.`];
  }else{
    shots=[`1. Then / Now: film ${value("moment").toLowerCase()} as it is today.`,`2. Share a short message about why this moment matters.`,`3. Future reflection: ${value("then-now")}`,`4. Parent checks the draft and footage before keeping or sharing privately.`];
  }
  return [`SAUCEAPPROVED KIDS STUDIO · ${kits[active].name}`,`Title: ${title}`,`Scene: ${idea}`,"",...shots,"","Parent review: required before filming or sharing.","Storage: downloaded on this device only; no server upload."].join("\n");
}
function checkDraft(){
  const flags=privacyFlags([value("title"),value("idea")].join(" "));
  if(active==="capsule")$("privacy-result").textContent=flags.length?`Review and remove: ${flags.join(", ")}.`:"No obvious contact details found. Parent review is still required.";
  return flags;
}
for(const button of document.querySelectorAll(".kit"))button.addEventListener("click",()=>chooseKit(button.dataset.kit));
document.addEventListener("click",event=>{if(event.target.id==="privacy-check")checkDraft();});
document.addEventListener("input",event=>{if(event.target.closest(".console")&&event.target.id!=="privacy-check")invalidate();});
$("preview").addEventListener("click",()=>{
  const flags=checkDraft();
  if(flags.length){$("message").textContent=`Remove ${flags.join(", ")} before export.`;return;}
  if(!$("parent").checked){$("message").textContent="Parent or guardian review is required to preview and save.";return;}
  reviewedPlan=buildPlan();$("output").textContent=reviewedPlan;
  $("save").disabled=false;$("message").textContent="Reviewed shot plan ready to save locally. Nothing was uploaded.";
});
$("save").addEventListener("click",()=>{
  if(!reviewedPlan||!$("parent").checked||privacyFlags([value("title"),value("idea")].join(" ")).length||reviewedPlan!==buildPlan()){
    invalidate();$("message").textContent="Review the latest draft before saving.";return;
  }
  const url=URL.createObjectURL(new Blob([reviewedPlan],{type:"text/plain;charset=utf-8"}));
  const link=document.createElement("a");link.href=url;link.download=`sauceapproved-${active}-shot-plan.txt`;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  $("message").textContent="Plan saved to your device. The parent decides whether and where to share it.";
});
chooseKit(active);
