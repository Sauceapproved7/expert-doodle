const PATTERNS=[
  {re:/^inspect (vault|forge|repo|body|system)$/i,verb:"inspect",mutates:false},
  {re:/^status (vault|forge|repo|body|system)$/i,verb:"status",mutates:false},
  {re:/^move body to (stand|sit|neutral|wave)$/i,verb:"move",target:"body",mutates:true},
  {re:/^arm body$/i,verb:"arm",target:"body",mutates:true},
  {re:/^emergency stop$/i,verb:"emergency-stop",target:"body",mutates:true}
];

function parse(text){
  const normalized=String(text??"").trim().replace(/\s+/g," ");
  for(const p of PATTERNS){
    const m=normalized.match(p.re);
    if(!m) continue;
    const target=p.target ?? m[1];
    const payload=p.verb==="move"?{pose:m[1]}:undefined;
    return {status:"planned",command:{verb:p.verb,target,mutates:p.mutates,payload}};
  }
  return {status:"unrecognized",reason:"command-not-recognized"};
}

export function createOperatorConsole({controller}={}) {
  if(!controller || typeof controller.run!=="function") throw new TypeError("governed controller required");
  return Object.freeze({
    async plan(text) {
      const parsed=parse(text);
      if(parsed.status!=="planned") return parsed;
      return {...parsed,requiresApproval:parsed.command.mutates===true};
    },
    async execute(text,context={}) {
      const plan=await this.plan(text);
      if(plan.status!=="planned") return {status:"unrecognized",reason:plan.reason};
      return controller.run(plan.command,context);
    }
  });
}
