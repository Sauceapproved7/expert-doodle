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
let active="hero",reviewedPlan=null,reviewedFingerprint=null;
const reviewIds=["review-operator","review-privacy","review-permission","review-sharing"];
const value=id=>$(id)?.value?.trim()||"";
const privacyFlags=text=>{
  const flags=[];
  if(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text))flags.push("email address");
  if(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(text))flags.push("phone-like number");
  if(/(?:https?:\/\/|www\.)\S+/i.test(text))flags.push("website link");
  if(/\b\d{1,6}\s+[a-z][\w\s]{0,36}\b(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln)\b/i.test(text))flags.push("possible street address");
  return flags;
};

const cameraGuide={
  "Wide and steady":"Keep the phone or camera steady and leave comfortable space around the action.",
  "Eye-level medium":"Film around eye level and keep the main person from about the waist or chest up.",
  "Detail close-up":"Move closer for one safe detail such as hands, a prop, or an expression without revealing private information."
};
const soundGuide={
  "Voices only":"Prioritize clear voices and keep background audio low.",
  "Natural room sound":"Keep a little safe room sound so the scene feels lived-in.",
  "Quiet / no music":"Let the pictures carry the moment with no planned music.",
  "Original family music":"Use only music the family created or has permission to use."
};
const transitionGuide={
  "Straight cut":"Move directly from one beat to the next.",
  "Match move":"End one shot on a motion and begin the next with a similar motion.",
  "Freeze-frame card":"Hold the final frame briefly before the next story card.",
  "Fade to black":"Use a calm visual pause before the next beat."
};
const transitionClass={
  "Straight cut":"reveal-cut",
  "Match move":"reveal-match",
  "Freeze-frame card":"reveal-freeze",
  "Fade to black":"reveal-fade"
};

function reviewComplete(){
  return reviewIds.every(id=>$(id)?.checked===true);
}
function updateLockStatus(){
  const complete=reviewIds.filter(id=>$(id)?.checked===true).length;
  const status=$("parent-lock-status");
  if(status)status.textContent="Parent Cut Lock: "+complete+" / "+reviewIds.length+" checks complete"+(complete===reviewIds.length?". Ready for a fresh storyboard preview.":".");
}
function clearStoryboard(){
  const root=$("storyboard");
  if(!root)return;
  root.replaceChildren();
  ["Build the story, then preview.","Your middle beat will appear here.","Your closing beat will appear here."].forEach((text,index)=>{
    const card=document.createElement("div");
    card.className="story-card";
    const label=document.createElement("b");
    label.textContent="SCENE 0"+(index+1);
    const copy=document.createElement("span");
    copy.textContent=text;
    card.append(label,copy);
    root.append(card);
  });
  $("mood-map").textContent="Pick the camera, sound, transition, and story energy. The reviewed preview turns those choices into one direction card.";
}
function invalidate(message="Draft changed. Preview and review again before saving."){
  reviewedPlan=null;
  reviewedFingerprint=null;
  $("save").disabled=true;
  $("output").textContent="";
  clearStoryboard();
  $("message").textContent=message;
}
function chooseKit(id){
  if(!kits[id])return;
  active=id;
  const kit=kits[id];
  for(const button of document.querySelectorAll(".kit"))button.setAttribute("aria-pressed",String(button.dataset.kit===id));
  $("workspace-title").textContent=kit.name;
  $("description").textContent=kit.description;
  $("feature-title").textContent=kit.first[0];
  $("feature-description").textContent=kit.first[1];
  $("feature-two-title").textContent=kit.second[0];
  $("feature-two-description").textContent=kit.second[1];
  $("kit-controls").innerHTML=kit.controls;
  $("feature-controls").innerHTML=kit.firstControls;
  $("feature-two-controls").innerHTML=kit.secondControls;
  $("title").value="";
  $("idea").value="";
  for(const id of reviewIds)$(id).checked=false;
  updateLockStatus();
  invalidate("Choose the story details, complete Parent Cut Lock, then build the storyboard.");
}
function buildPlan(){
  const title=value("title")||"Untitled family story";
  const idea=value("idea")||"A private, parent-approved scene.";
  const shotStyle=value("shot-style");
  const soundPlan=value("sound-plan");
  const transition=value("transition-style");
  const energy=value("story-energy");
  let shots=[];
  let cards=[];

  if(active==="hero"){
    const challenge=value("challenge");
    const choice=value("choice");
    const replay=value("replay");
    shots=[
      "1. Establish the challenge: "+challenge+".",
      "2. Choice Compass: show the hero choosing to "+choice.toLowerCase()+".",
      "3. Show how that choice helps.",
      "Alternate ending — Courage Replay: "+replay+". Film this as a separate ending and compare the two."
    ];
    cards=[
      {label:"SCENE 01 · CHALLENGE",text:challenge},
      {label:"SCENE 02 · CHOICE",text:choice},
      {label:"SCENE 03 · REPLAY",text:replay}
    ];
  }else if(active==="director"){
    const seconds=Number(value("beat-board"));
    const format=value("format");
    const focus=value("role-swap");
    shots=[
      "0–"+seconds+"s: Open the "+format.toLowerCase()+" scene and show the space.",
      seconds+"–"+(seconds*2)+"s: Perform the main moment.",
      (seconds*2)+"–"+(seconds*3)+"s: End with a clear pose or closing beat.",
      "Role Swap: director view — "+focus+". Performer view — choose a comfortable angle together and capture a second take."
    ];
    cards=[
      {label:"SCENE 01 · OPEN",text:"Set the "+format.toLowerCase()+" scene."},
      {label:"SCENE 02 · FOCUS",text:focus},
      {label:"SCENE 03 · FINISH",text:"Close with "+energy.toLowerCase()+" energy."}
    ];
  }else{
    const moment=value("moment");
    const future=value("then-now");
    shots=[
      "1. Then / Now: film "+moment.toLowerCase()+" as it is today.",
      "2. Share a short message about why this moment matters.",
      "3. Future reflection: "+future,
      "4. Parent checks the draft and footage before keeping or sharing privately."
    ];
    cards=[
      {label:"SCENE 01 · TODAY",text:moment},
      {label:"SCENE 02 · MEANING",text:"Say why this moment matters."},
      {label:"SCENE 03 · FUTURE",text:future}
    ];
  }

  const mood=energy+" · "+shotStyle+" · "+soundPlan+" · "+transition+".";
  const text=[
    "SAUCEAPPROVED KIDS STUDIO V2 · "+kits[active].name,
    "Title: "+title,
    "Scene: "+idea,
    "",
    ...shots,
    "",
    "Camera Coach: "+shotStyle+" — "+cameraGuide[shotStyle],
    "Sound Map: "+soundPlan+" — "+soundGuide[soundPlan],
    "Transition Lab: "+transition+" — "+transitionGuide[transition],
    "Mood-to-Motion Map: "+mood,
    "",
    "Parent Cut Lock: all four review checks required before local export.",
    "Storage: downloaded on this device only; no server upload."
  ].join("\n");
  return {text,cards,mood,fingerprint:text};
}
function renderStoryboard(cards){
  const root=$("storyboard");
  root.replaceChildren();
  const reveal=transitionClass[value("transition-style")]||"reveal-cut";
  cards.forEach((item,index)=>{
    const card=document.createElement("div");
    card.className="story-card "+reveal;
    card.style.animationDelay=(index*90)+"ms";
    const label=document.createElement("b");
    label.textContent=item.label;
    const copy=document.createElement("span");
    copy.textContent=item.text;
    card.append(label,copy);
    root.append(card);
  });
}
function checkDraft(){
  const flags=privacyFlags([value("title"),value("idea")].join(" "));
  if(active==="capsule"&&$("privacy-result"))$("privacy-result").textContent=flags.length?"Review and remove: "+flags.join(", ")+".":"No obvious contact details found. Parent review is still required.";
  return flags;
}

for(const button of document.querySelectorAll(".kit"))button.addEventListener("click",()=>chooseKit(button.dataset.kit));
document.addEventListener("click",event=>{
  if(event.target.id==="privacy-check")checkDraft();
});
document.addEventListener("input",event=>{
  if(!event.target.closest(".console")||event.target.id==="privacy-check")return;
  updateLockStatus();
  invalidate(reviewIds.includes(event.target.id)?"Parent review changed. Build a fresh storyboard after all four checks are complete.":"Creative direction changed. Build a fresh reviewed storyboard before saving.");
});

$("preview").addEventListener("click",()=>{
  const flags=checkDraft();
  if(flags.length){
    $("message").textContent="Remove "+flags.join(", ")+" before export.";
    return;
  }
  if(!reviewComplete()){
    updateLockStatus();
    $("message").textContent="Parent Cut Lock requires all four review checks before the storyboard can be approved.";
    return;
  }
  const plan=buildPlan();
  reviewedPlan=plan.text;
  reviewedFingerprint=plan.fingerprint;
  $("output").textContent=plan.text;
  renderStoryboard(plan.cards);
  $("mood-map").textContent=plan.mood+" "+cameraGuide[value("shot-style")]+" "+soundGuide[value("sound-plan")];
  $("save").disabled=false;
  $("message").textContent="Reviewed storyboard ready to save locally. Nothing was uploaded.";
});

$("save").addEventListener("click",()=>{
  const latest=buildPlan();
  if(!reviewedPlan||!reviewComplete()||privacyFlags([value("title"),value("idea")].join(" ")).length||reviewedFingerprint!==latest.fingerprint||reviewedPlan!==latest.text){
    invalidate("Parent Cut Lock blocked export. Review the latest draft and build a fresh storyboard.");
    updateLockStatus();
    return;
  }
  const url=URL.createObjectURL(new Blob([reviewedPlan],{type:"text/plain;charset=utf-8"}));
  const link=document.createElement("a");
  link.href=url;
  link.download="sauceapproved-"+active+"-shot-plan-v2.txt";
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  $("message").textContent="Plan saved to this device. The parent decides whether and where to share it.";
});

chooseKit(active);
