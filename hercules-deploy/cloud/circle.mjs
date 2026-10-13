// Founding Circle's readiness exercise is local-only and does not store, submit,
// or attest infrastructure data. Never treat a self-reported score as production approval.
const checklist=document.getElementById('checklist');
const score=document.getElementById('readiness-score');
const note=document.getElementById('score-note');
const progress=document.getElementById('progress-meter');
const fill=document.getElementById('meter-fill');
const checks=Array.from(checklist?.querySelectorAll('input[type="checkbox"]')||[]);
const TOTAL=7;
function updateReadiness(){
 const passed=checks.filter(input=>input.checked).length;
 if(score)score.textContent=passed+' / '+TOTAL;
 if(fill)fill.style.width=(passed/TOTAL*100)+'%';
 if(progress)progress.setAttribute('aria-valuenow',String(passed));
 if(note)note.textContent=passed===0
  ?'Begin by identifying who owns your host and what it costs.'
  :passed<TOTAL
   ?'You have '+(TOTAL-passed)+' item'+(TOTAL-passed===1?'':'s')+' left to assess. This remains self-reported.'
   :'All questions checked. Independent proof and owner release approval are still required.';
}
checklist?.addEventListener('change',updateReadiness);
document.getElementById('reset-checklist')?.addEventListener('click',()=>{
 for(const check of checks)check.checked=false;
 updateReadiness();
});
updateReadiness();
