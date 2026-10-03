const PATTERNS=[
  {re:/^inspect (vault|forge|repo|body|system)$/i,verb:"inspect",mutates:false},
  {re:/^status (vault|forge|repo|body|system)$/i,verb:"status",mutates:false},
  {re:/^move body to (stand|sit|neutral|wave)$/i,verb:"move",target:"body",mutates:true},
  {re:/^arm body$/i,verb:"arm",target:"body",mutates:true},
  {re:/^emergency stop$/i,verb:"emergency-stop",target:"body",mutates:true},
  {re:/^open browser (https?:\\/\\/\\S+)$/i,verb:"browser-navigate",target:"browser",mutates:true},
  {re:/^inspect browser (https?:\\/\\/\\S+)$/i,verb:"browser-scrape",target:"browser",mutates:true},
  {re:/^deployment status ([A-Za-z0-9][A-Za-z0-9._:-]{0,199})$/i,verb:"deploy-status",target:"deployer",mutates:false},
  {re:/^deploy release ([A-Za-z0-9][A-Za-z0-9._:-]{0,199}) commit ([A-Za-z0-9][A-Za-z0-9._:-]{0,199}) artifact ([A-Za-z0-9][A-Za-z0-9._:-]{0,199}) target ([A-Za-z0-9][A-Za-z0-9._:-]{0,199}) ([A-Za-z0-9][A-Za-z0-9._:-]{0,199})$/i,verb:"deploy-release",target:"deployer",mutates:true}
];

function parse(text){
  const normalized=String(text??"").trim().replace(/\s+/g," ");
  for(const p of PATTERNS){
    const m=normalized.match(p.re);
    if(!m) continue;
    const target=p.target ?? m[1];
    let payload=p.verb==="move"?{pose:m[1]}:(p.verb.startsWith("browser-")?{target:m[1]}:undefined);
    if(p.verb==="deploy-status") payload={deploymentId:m[1]};
    if(p.verb==="deploy-release") payload={releaseId:m[1],sourceCommit:m[2],artifactFingerprint:m[3],target:{kind:m[4],reference:m[5]}};
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
