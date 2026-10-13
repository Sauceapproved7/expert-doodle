// Owner-written, isolated experiment: prompt sensitivity vs genuine 360M math.
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {parseFreeModelBudgetLog,RENDER_FREE_LIMITS} from "./hercules-render-free-model-budget.mjs";

export const MATH_PROMPT_CASES=Object.freeze([
  Object.freeze({id:"addition",prompt:"What is 2 plus 2? Reply with the number only.",expected:"4"}),
  Object.freeze({id:"compare",prompt:"Which number is larger: 7 or 12? Reply with the larger number only.",expected:"12"}),
  Object.freeze({id:"subtraction",prompt:"What is 5 minus 3? Reply with the number only.",expected:"2"}),
]);
export const MATH_PROMPT_MODES=Object.freeze(["baseline","system"]);

function normalizedAnswer(value){
  if(typeof value!=="string"||value.length>2048)return null;
  let s=value.trim().toLowerCase().replace(/[.!?]+$/,"").trim();
  s=s.replace(/^the (?:answer|result|larger number) is\s+/,"").trim();
  s=s.replace(/^(?:2\s*\+\s*2|5\s*[-−]\s*3)\s*=\s*/,"").trim();
  return /^\d+$/.test(s)?s:null;
}


function isSemanticallyCorrect(testCase,raw){
  if(typeof raw!=="string"||raw.length>2048)return false;
  if(normalizedAnswer(raw)===testCase.expected)return true;
  const text=raw.trim().toLowerCase().replace(/[.!?]+$/,"").trim();
  if(testCase.id==="addition")
    return /^2\s*(?:\+|plus)\s*2\s*(?:=|equals)\s*4$/.test(text);
  if(testCase.id==="subtraction")
    return /^5\s*(?:-|−|minus)\s*3\s*(?:=|equals)\s*2$/.test(text);
  if(testCase.id==="compare")
    return /^12\s+is\s+(?:the\s+)?larger(?:\s+number)?(?:\s+than\s+7)?$/.test(text);
  return false;
}

export function evaluateMathPromptDiagnostic(evidence){
  const q=evidence?.cpuQuotaMicros,p=evidence?.cpuPeriodMicros,lim=evidence?.memoryLimitBytes,rss=evidence?.processPeakRssBytes;
  const measuredBudget=Number.isSafeInteger(q)&&Number.isSafeInteger(p)&&p>0&&
    q/p===RENDER_FREE_LIMITS.cpuFraction &&
    lim===RENDER_FREE_LIMITS.memoryBytes &&
    Number.isSafeInteger(rss)&&rss>0&&rss<=lim;
  const responses=Array.isArray(evidence?.responses)?evidence.responses:[];
  const uniqueKeys=new Set();
  let allUnique=true;
  for(const row of responses){
    const key=String(row?.id)+"/"+String(row?.mode);
    if(uniqueKeys.has(key))allUnique=false;
    uniqueKeys.add(key);
  }
  const rows=[];
  for(const c of MATH_PROMPT_CASES){
    for(const mode of MATH_PROMPT_MODES){
      const matches=responses.filter(row=>row?.id===c.id&&row.mode===mode);
      const entry=matches.length===1?matches[0]:null;
      const choice=entry?.reply?.choices;
      const body=Array.isArray(choice)&&choice.length===1?choice[0]:null;
      const valid=Boolean(entry?.reply?.model==="hercules-trial"&&body?.finish_reason==="stop"&&
        body?.message?.role==="assistant"&&typeof body.message.content==="string"&&
        body.message.content.trim()&&body.message.content.length<=2048 &&
        Number.isSafeInteger(entry.elapsedMs)&&entry.elapsedMs>0&&entry.elapsedMs<=150000);
      const actual=valid?body.message.content.trim():null;
      rows.push(Object.freeze({
        id:c.id,mode,valid,correct:Boolean(valid&&isSemanticallyCorrect(c,actual)),
        formatCorrect:Boolean(valid&&actual===c.expected),
        elapsedMs:valid?entry.elapsedMs:null,
        observedText:actual?.slice(0,160)||null
      }));
    }
  }
  const diagnosticComplete=Boolean(measuredBudget&&allUnique&&responses.length===6&&rows.every(row=>row.valid));
  function group(mode){
    const groupRows=rows.filter(row=>row.mode===mode);
    return Object.freeze({
      correct:groupRows.filter(row=>row.correct).length,
      formatCorrect:groupRows.filter(row=>row.formatCorrect).length,
      wrong:groupRows.filter(row=>row.valid&&!row.correct).length,
      p95Ms:groupRows.every(row=>row.valid)?
        [...groupRows.map(row=>row.elapsedMs)].sort((a,b)=>a-b)[Math.ceil(.95*groupRows.length)-1]:null
    });
  }
  return Object.freeze({
    schema:"hercules.model.math-prompt-diagnostic.v1",
    model:"SmolLM2-360M-Instruct.Q4_K_M.gguf",
    cgroupBudgetVerified:Boolean(measuredBudget),
    processPeakRssBytes:Number.isSafeInteger(rss)&&rss>0?rss:null,
    completedTrials:rows.filter(row=>row.valid).length,
    diagnosticComplete,
    baseline:group("baseline"),
    system:group("system"),
    allQuestionsCorrect:diagnosticComplete&&rows.every(row=>row.correct),
    rows,
    promptComparisonOnly:true,
    productionQualified:false,
    publicReleaseApproved:false,
    paidCommerceEnabled:false
  });
}

export function parseMathPromptEvidence(source){
  if(typeof source!=="string"||source.length>130000)throw new TypeError("invalid experiment log");
  const lines=source.split(/\r?\n/);
  const keys=new Map();
  for(const line of lines){
    if(!line.startsWith("HERCULES_"))continue;
    const match=/^(HERCULES_[A-Z0-9_]+)=(.*)$/.exec(line);
    if(!match||keys.has(match[1]))throw new TypeError("duplicate or invalid evidence key");
    keys.set(match[1],match[2]);
  }
  const int=name=>{
    const value=keys.get(name);
    if(!value||!/^[0-9]+$/.test(value))throw new TypeError("missing measured numeric value");
    const number=Number(value);
    if(!Number.isSafeInteger(number))throw new TypeError("invalid measurement");
    return number;
  };
  const cpuQuotaMicros=int("HERCULES_CPU_QUOTA");
  const cpuPeriodMicros=int("HERCULES_CPU_PERIOD");
  const memoryLimitBytes=int("HERCULES_MEMORY_LIMIT");
  const memoryPeakBytes=int("HERCULES_MEMORY_PEAK");
  const processPeakRssBytes=int("HERCULES_PROCESS_PEAK_RSS_BYTES");
  const responses=MATH_PROMPT_CASES.flatMap(c=>MATH_PROMPT_MODES.map(mode=>{
    const prefix="HERCULES_CASE_"+c.id.toUpperCase()+"_"+mode.toUpperCase();
    const elapsedMs=int(prefix+"_MS");
    const encoded=keys.get(prefix+"_HTTP");
    if(!encoded||encoded.length>25000)throw new TypeError("missing bounded case response");
    const record=[
      "HERCULES_CPU_QUOTA="+cpuQuotaMicros,
      "HERCULES_CPU_PERIOD="+cpuPeriodMicros,
      "HERCULES_MEMORY_LIMIT="+memoryLimitBytes,
      "HERCULES_MEMORY_PEAK="+memoryPeakBytes,
      "HERCULES_PROCESS_PEAK_RSS_BYTES="+processPeakRssBytes,
      "HERCULES_ELAPSED_MS="+elapsedMs,
      "HERCULES_MODEL_REPLY_BASE64="+encoded
    ].join("\n");
    const parsed=parseFreeModelBudgetLog(record);
    return {id:c.id,mode,elapsedMs,reply:parsed.modelReply};
  }));
  if(keys.size!==5+responses.length*2)throw new TypeError("extra or missing evidence fields");
  return {cpuQuotaMicros,cpuPeriodMicros,memoryLimitBytes,processPeakRssBytes,responses};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  if(process.argv[2]!=="--evaluate"||!process.argv[3])throw new Error("only local evaluation is supported");
  try {
    const report=evaluateMathPromptDiagnostic(parseMathPromptEvidence(readFileSync(process.argv[3],"utf8")));
    process.stdout.write(JSON.stringify(report)+"\n");
    if(!report.diagnosticComplete)process.exitCode=1;
  }catch{
    process.stdout.write(JSON.stringify({
      diagnosticComplete:false,productionQualified:false,publicReleaseApproved:false,
      error:"real_math_prompt_evidence_unavailable"
    })+"\n");
    process.exitCode=1;
  }
}
