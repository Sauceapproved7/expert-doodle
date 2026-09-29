const KITS=Object.freeze([
  Object.freeze({id:"hero",name:"Neighborhood Hero",genre:"Adventure",accent:"#e9a662",summary:"Make a three-shot story about helping someone in your world.",differentiators:["Choice Compass — try two decisions and see how the story changes","Courage Replay — build an alternate ending that celebrates a different kind of bravery"]}),
  Object.freeze({id:"director",name:"Dream Director",genre:"Creative spotlight",accent:"#d6a9ec",summary:"Direct a short performance, story, or style film on your terms.",differentiators:["Beat Board — arrange shots on a silent rhythm grid","Role Swap — plan both the director and performer view of the same scene"]}),
  Object.freeze({id:"capsule",name:"Time Capsule",genre:"Family keepsake",accent:"#9bd9c7",summary:"Capture a moment today and make a note for the future.",differentiators:["Then / Now — pair a present-day shot with a future reflection","Privacy Check — catch obvious personal details in the script before export"]})
]);

const CAPABILITIES=Object.freeze([
  Object.freeze({id:"storyboard-deck",name:"Storyboard Deck",summary:"Turns the reviewed plan into three visual scene cards before anything is saved."}),
  Object.freeze({id:"camera-coach",name:"Camera Coach",summary:"Adds simple framing guidance that a parent can use with the local vintage camera."}),
  Object.freeze({id:"sound-map",name:"Sound Map",summary:"Plans dialogue, room sound, quiet, or family-owned music without recording or uploading audio."}),
  Object.freeze({id:"transition-lab",name:"Transition Lab",summary:"Lets the family choose a clear cut style before filming instead of fixing the story later."}),
  Object.freeze({id:"parent-cut-lock",name:"Parent Cut Lock",summary:"Requires four explicit parent review checks and a fresh preview before local export."}),
  Object.freeze({id:"mood-to-motion-map",name:"Mood-to-Motion Map",summary:"Connects story energy, framing, sound, and transition choices into one readable direction card."})
]);

const REVIEW_POLICY=Object.freeze({
  requiredChecks:Object.freeze(["operator","privacy","permission","sharing"]),
  saveRequiresFreshPreview:true
});

export function createKidsStudioManifest(){
  return Object.freeze({schema:"sauceapproved.studio.kids",version:2,product:"SauceApproved Kids Studio",audience:"parent-operated family creation",storage:"device-only",serverUpload:false,childAccounts:false,publishing:false,executionPolicy:"parent-review-required",capabilities:CAPABILITIES,reviewPolicy:REVIEW_POLICY,kits:KITS});
}

export function renderKidsStudio(){
  const cards=KITS.map((kit,index)=>`<button class="kit" type="button" data-kit="${kit.id}" style="--accent:${kit.accent}" aria-pressed="${index===0}">
    <span class="number">0${index+1} / ${kit.genre}</span><strong>${kit.name}</strong><span>${kit.summary}</span>
    <small>${kit.differentiators.map(value=>`<span>✦ ${value}</span>`).join("")}</small>
  </button>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Kids Studio — SauceApproved</title><meta name="description" content="Three parent-operated story kits in the Hercules vintage camera studio.">
<style>
:root{font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#f6eee3;background:#090b0e;--gold:#e8bc78}*{box-sizing:border-box}
body{margin:0;background:radial-gradient(circle at 70% -20%,#3e302e 0,#11151b 40%,#090b0e 75%);min-height:100vh}
main{max-width:1260px;margin:auto;padding:clamp(18px,4vw,48px)}a{color:inherit}.back{font-size:13px;color:#c4b3a0;text-decoration:none;font-weight:800}
.mast{display:flex;justify-content:space-between;align-items:center;gap:20px;margin:36px 0 16px}.over{color:var(--gold);letter-spacing:.22em;text-transform:uppercase;font-size:11px;font-weight:900}
h1{font-size:clamp(48px,9vw,110px);line-height:.89;letter-spacing:-.075em;margin:12px 0 22px}h1 em{font-style:normal;color:var(--gold)}.intro{max-width:680px;color:#bdb3aa;font-size:18px}
.dial{width:130px;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;text-align:center;color:#f7e4c5;font-size:12px;letter-spacing:.14em;font-weight:900;border:12px ridge #7f6147;box-shadow:0 0 0 8px #1a1818,0 25px 40px #0009;background:radial-gradient(circle,#513829,#1e1714)}
.kits{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:42px 0 20px}.kit{appearance:none;text-align:left;padding:25px;min-height:315px;border:1px solid #3a3736;border-radius:23px;background:linear-gradient(145deg,#252428,#14171d);color:inherit;cursor:pointer;display:flex;flex-direction:column;gap:16px;transition:transform .2s,border-color .2s}.kit:hover,.kit:focus-visible{transform:translateY(-4px);border-color:var(--accent)}.kit[aria-pressed=true]{border-color:var(--accent);box-shadow:inset 0 3px var(--accent),0 15px 50px #0007}.kit .number{color:var(--accent);font-size:12px;letter-spacing:.15em;text-transform:uppercase;font-weight:900}.kit strong{font-size:clamp(26px,3vw,38px);line-height:1;letter-spacing:-.05em}.kit>span:not(.number){color:#d1c7bf}.kit small{display:grid;gap:8px;margin-top:auto;color:#d0c2b5;font-size:12px;line-height:1.45}
.console{border:1px solid #685540;background:linear-gradient(150deg,#332b25,#15191d 56%);border-radius:28px;padding:clamp(20px,4vw,42px);box-shadow:0 25px 80px #0008}.console-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.lamp{color:#efd2ae;font-size:11px;font-weight:900;letter-spacing:.15em}.lamp:before{content:"";display:inline-block;width:9px;height:9px;margin-right:8px;border-radius:50%;background:#f2775e;box-shadow:0 0 14px #ff745e}
h2{font-size:clamp(30px,5vw,52px);letter-spacing:-.05em;margin:20px 0 6px}.muted{color:#baa99a}.work{display:grid;grid-template-columns:1fr 1fr;gap:25px;margin-top:25px}label{display:block;margin:14px 0;font-size:13px;font-weight:800;color:#e4d8c9}input,select,textarea{display:block;width:100%;margin-top:7px;background:#111419;border:1px solid #6a5749;border-radius:11px;padding:12px;color:#fff;font:inherit}textarea{resize:vertical;min-height:90px}
.feature{border:1px solid #665344;border-radius:18px;padding:20px;background:#18191bd9}.feature h3{margin:0;font-size:20px}.feature p{margin:7px 0;color:#bbaea0;font-size:13px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:25px}button.action,a.action{border:1px solid #82634b;border-radius:12px;padding:13px 18px;background:#e8bc78;color:#1b1510;font-weight:900;text-decoration:none;cursor:pointer}.action.secondary{background:#25282c;color:#e8d7c4}button:disabled{opacity:.42;cursor:not-allowed}
.review{border:1px solid #88704f;border-radius:16px;padding:17px;margin-top:22px;background:#241f1b}.review label{font-weight:500}.review input{display:inline;width:auto;margin:0 8px 0 0}.note{font-size:12px;color:#bbaea0;margin-top:18px}.output{white-space:pre-wrap;background:#0b0d10;border:1px solid #635140;padding:20px;border-radius:16px;margin-top:18px;color:#e9dfd1;min-height:90px}.output:empty{display:none}
.creative-rig{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:22px}.rig-control{border:1px solid #5d5047;border-radius:16px;padding:14px;background:#121519}.rig-control label{margin:0}.rig-control span{display:block;color:#bbaea0;font-size:11px;margin-top:7px}
.v2-grid{display:grid;grid-template-columns:1.35fr .65fr;gap:16px;margin-top:18px}.storyboard-wrap,.motion-map{border:1px solid #5d5047;border-radius:20px;padding:18px;background:#121417}.storyboard-wrap h3,.motion-map h3{margin:0 0 6px}.storyboard{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.story-card{min-height:150px;border:1px solid #4f4945;border-radius:16px;padding:14px;background:linear-gradient(160deg,#211d1a,#0e1115);display:flex;flex-direction:column;gap:8px}.story-card b{color:var(--gold);font-size:11px;letter-spacing:.12em}.story-card span{color:#d7ccc0;font-size:13px}.motion-map p{color:#c6b9ac;font-size:13px;line-height:1.55}.lock-status{margin-top:10px;padding:10px 12px;border-radius:12px;background:#171a1e;color:#d4c7ba;font-size:12px}.review-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.review-grid label{margin:0;padding:10px;border:1px solid #4c433d;border-radius:12px;background:#171719}

@media(max-width:900px){.creative-rig{grid-template-columns:1fr 1fr}.v2-grid{grid-template-columns:1fr}}@media(max-width:800px){.kits{grid-template-columns:1fr}.kit{min-height:0}.work{grid-template-columns:1fr}.dial{width:85px;border-width:8px;font-size:9px}.mast{align-items:flex-start}.creative-rig,.review-grid,.storyboard{grid-template-columns:1fr}}
</style></head><body><main><a class="back" href="/">← SAUCEAPPROVED STUDIO</a><div class="mast"><div><div class="over">HERCULES / FAMILY FILM DIVISION</div><h1>Little stories.<br><em>Big screen.</em></h1><p class="intro">Three original story kits, one vintage camera spirit. Build the scene, frame the shot, map the sound, preview the storyboard, then let Parent Cut Lock control local export.</p></div><div class="dial" aria-hidden="true">STORY<br>MODE<br>●</div></div>
<section class="kits" aria-label="Choose a story kit">${cards}</section>
<section class="console" aria-labelledby="workspace-title"><div class="console-head"><span class="lamp">HERCULES / VIEWFINDER</span><span class="over">PRIVATE DRAFT / DEVICE ONLY</span></div><h2 id="workspace-title">Neighborhood Hero</h2><p id="description" class="muted">Choose a decision, then see another way the hero could help.</p>
<div class="work"><div><label>Story title <input id="title" maxlength="80" placeholder="A small act of courage" autocomplete="off"></label><label>Scene idea (keep names and locations private)<textarea id="idea" maxlength="400" placeholder="A friend needs help carrying something..."></textarea></label><div id="kit-controls"></div></div><div><div class="feature"><h3 id="feature-title">Choice Compass</h3><p id="feature-description"></p><div id="feature-controls"></div></div><div class="feature" style="margin-top:14px"><h3 id="feature-two-title">Courage Replay</h3><p id="feature-two-description"></p><div id="feature-two-controls"></div></div></div></div>
<div class="creative-rig" aria-label="Creative direction controls">
  <div class="rig-control"><label>Camera Coach<select id="shot-style"><option>Wide and steady</option><option>Eye-level medium</option><option>Detail close-up</option></select></label><span>Simple framing guidance for the next take.</span></div>
  <div class="rig-control"><label>Sound Map<select id="sound-plan"><option>Voices only</option><option>Natural room sound</option><option>Quiet / no music</option><option>Original family music</option></select></label><span>No audio is recorded or uploaded here.</span></div>
  <div class="rig-control"><label>Transition Lab<select id="transition-style"><option>Straight cut</option><option>Match move</option><option>Freeze-frame card</option><option>Fade to black</option></select></label><span>Choose the handoff between story beats.</span></div>
  <div class="rig-control"><label>Story energy<select id="story-energy"><option>Warm and calm</option><option>Playful bounce</option><option>Bold spotlight</option></select></label><span>Feeds the Mood-to-Motion Map.</span></div>
</div>
<div class="v2-grid">
  <section class="storyboard-wrap" aria-labelledby="storyboard-title"><h3 id="storyboard-title">Storyboard Deck</h3><p class="muted">Three kid-friendly scene cards appear after parent review.</p><div id="storyboard" class="storyboard" aria-live="polite"><div class="story-card"><b>SCENE 01</b><span>Build the story, then preview.</span></div><div class="story-card"><b>SCENE 02</b><span>Your middle beat will appear here.</span></div><div class="story-card"><b>SCENE 03</b><span>Your closing beat will appear here.</span></div></div></section>
  <aside class="motion-map"><h3>Mood-to-Motion Map</h3><p id="mood-map">Pick the camera, sound, transition, and story energy. The reviewed preview turns those choices into one direction card.</p></aside>
</div>
<div class="review"><strong>Parent review required · Parent Cut Lock</strong><div class="review-grid">
<label><input id="review-operator" type="checkbox"> I am the parent or guardian operating this tool.</label>
<label><input id="review-privacy" type="checkbox"> I checked the draft for names, contact details, and private locations.</label>
<label><input id="review-permission" type="checkbox"> I have permission to film everyone who will appear.</label>
<label><input id="review-sharing" type="checkbox"> I will decide where, whether, and with whom the finished media is shared.</label>
</div><div id="parent-lock-status" class="lock-status" role="status">Parent Cut Lock: 0 / 4 checks complete.</div></div>
<div class="actions"><button class="action" id="preview" type="button">Build reviewed storyboard</button><button class="action secondary" id="save" type="button" disabled>Save reviewed plan</button><a class="action secondary" href="/vintage-camera">Open vintage camera ↗</a></div><div id="message" class="note" role="status" aria-live="polite">No account, upload, cloud generation, or public posting is available here.</div><div id="output" class="output" aria-live="polite"></div></section>
<p class="note">This planner stores no draft on the server. Saving downloads a text plan to your device. The camera is a separate local-first tool; it does not automatically receive this draft. Keep a parent present when recording or sharing children’s media.</p></main><script src="/assets/kids-studio.js" defer></script></body></html>`;
}
