import {createHash} from "node:crypto";

function clamp(value,min,max){return Math.max(min,Math.min(max,value));}

function assertCase(input){
  if(!input||typeof input!=="object")throw new TypeError("recovery case is required");
  if(typeof input.invoiceId!=="string"||!input.invoiceId.trim())throw new TypeError("invoiceId is required");
  if(!Number.isInteger(input.amountCents)||input.amountCents<0)throw new TypeError("amountCents must be a non-negative integer");
  if(!Number.isInteger(input.daysOverdue)||input.daysOverdue<0)throw new TypeError("daysOverdue must be a non-negative integer");
}

function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==="object"){
    return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  }
  return value;
}

function digest(value){
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function priorityScore(input){
  const overdue=clamp(input.daysOverdue/90,0,1)*45;
  const balance=clamp(input.amountCents/500000,0,1)*35;
  const silence=clamp((input.contact?.lastResponseDaysAgo??0)/30,0,1)*20;
  return Math.round(overdue+balance+silence);
}

function result(input,{state,safeToContact,nextAction,reasonCodes,confidence}){
  const score=priorityScore(input);
  const evidence={
    invoiceId:input.invoiceId,
    amountCents:input.amountCents,
    daysOverdue:input.daysOverdue,
    disputeOpen:Boolean(input.dispute?.open),
    paymentMatched:Boolean(input.paymentEvidence?.matched),
    promiseStatus:input.promiseToPay?.status??null,
    doNotContact:Boolean(input.contact?.doNotContact),
    lastResponseDaysAgo:input.contact?.lastResponseDaysAgo??null,
  };
  return Object.freeze({
    schema:"hercules.recovery.assessment.v1",
    state,
    priorityScore:score,
    confidence,
    safeToContact,
    reasonCodes:Object.freeze([...reasonCodes]),
    nextAction:Object.freeze(nextAction),
    evidence:Object.freeze(evidence),
    evidenceSha256:digest(evidence),
  });
}

export function assessRecoveryCase(input){
  assertCase(input);

  if(input.paymentEvidence?.matched){
    const matched=input.paymentEvidence.matchedAmountCents;
    if(Number.isInteger(matched)&&matched>=input.amountCents){
      return result(input,{
        state:"PAID_EVIDENCE",
        safeToContact:false,
        reasonCodes:["PAYMENT_MATCHED"],
        confidence:"HIGH",
        nextAction:{type:"NONE",requiresApproval:false},
      });
    }
  }

  if(input.contact?.doNotContact){
    return result(input,{
      state:"CONTACT_BLOCKED",
      safeToContact:false,
      reasonCodes:["DO_NOT_CONTACT"],
      confidence:"HIGH",
      nextAction:{type:"HUMAN_REVIEW",requiresApproval:true},
    });
  }

  if(input.dispute?.open){
    return result(input,{
      state:"DISPUTED",
      safeToContact:false,
      reasonCodes:["OPEN_DISPUTE"],
      confidence:"HIGH",
      nextAction:{type:"HUMAN_REVIEW",requiresApproval:true},
    });
  }

  if(input.promiseToPay?.status==="active"){
    return result(input,{
      state:"PROMISE_ACTIVE",
      safeToContact:false,
      reasonCodes:["ACTIVE_PROMISE_TO_PAY"],
      confidence:"HIGH",
      nextAction:{type:"WAIT_FOR_PROMISE",requiresApproval:false},
    });
  }

  const reasons=[];
  if(input.daysOverdue>0)reasons.push("OVERDUE");
  if(input.daysOverdue>=30)reasons.push("AGING_30_PLUS");
  if(input.daysOverdue>=60)reasons.push("AGING_60_PLUS");
  if(input.amountCents>=250000)reasons.push("HIGH_BALANCE");
  if((input.contact?.lastResponseDaysAgo??0)>=14)reasons.push("CUSTOMER_SILENT");

  if(input.daysOverdue===0){
    return result(input,{
      state:"NOT_DUE_FOR_RECOVERY",
      safeToContact:false,
      reasonCodes:["NOT_OVERDUE"],
      confidence:"HIGH",
      nextAction:{type:"NONE",requiresApproval:false},
    });
  }

  return result(input,{
    state:"RECOVERY_READY",
    safeToContact:true,
    reasonCodes:reasons,
    confidence:"MEDIUM",
    nextAction:{
      type:"PERSONALIZED_FOLLOW_UP",
      requiresApproval:true,
      channelPolicy:"OWNER_APPROVED_ONLY",
    },
  });
}
