const READ_TARGETS=new Set(["vault","system","forge","repo","body"]);
const BODY_POSES=new Set(["stand","sit","neutral","wave"]);

function parse(text){
  const parts=String(text??"").split(/\s+and\s+/i).map(s=>s.trim()).filter(Boolean);
  const steps=[];
  for(const p of parts){
    let m=p.match(/^inspect (?:the )?(vault|system|forge|repo|body)$/i);
    if(m){steps.push({verb:"inspect",target:m[1].toLowerCase(),mutates:false});continue;}
    m=p.match(/^check (?:the )?(vault|system|forge|repo|body)$/i);
    if(m){steps.push({verb:"status",target:m[1].toLowerCase(),mutates:false});continue;}
    m=p.match(/^deploy production$/i);
    if(m){steps.push({verb:"deploy",target:"production",mutates:true,irreversible:true});continue;}
    m=p.match(/^move body to (stand|sit|neutral|wave)$/i);
    if(m){steps.push({verb:"move",target:"body",mutates:true,payload:{pose:m[1].toLowerCase()}});continue;}
    return {status:"unrecognized",reason:"mission-step-not-recognized"};
  }
  return {status:"planned",steps};
}

export function createMissionEngine({executor}={}) {
  if(typeof executor!=="function") throw new TypeError("governed executor required");
  return Object.freeze({
    async plan(text){
      const parsed=parse(text);
      if(parsed.status!=="planned") return parsed;
      const requiresApproval=parsed.steps.some(s=>s.mutates||s.irreversible);
      return Object.freeze({
        mode:"plan-only",
        status:"planned",
        requiresApproval,
        steps:Object.freeze(parsed.steps.map(s=>Object.freeze({...s})))
      });
    },
    async execute(plan,context={}) {
      if(!plan || plan.status!=="planned") return {status:"unrecognized"};
      if(plan.requiresApproval && context.ownerApproved!==true) {
        return {status:"awaiting-approval",steps:plan.steps.length};
      }
      const receipts=[];
      for(const step of plan.steps){
        const evidence=await executor(step,context);
        receipts.push(Object.freeze({step:Object.freeze({...step}),evidence}));
      }
      return {status:"completed",receipts};
    }
  });
}
