// Hercules original deterministic arithmetic. No model, network, eval or provider.
// This is deliberately NOT a general math solver or proof of neural inference.
const INTEGER=String.raw`[+-]?(?:0|[1-9][0-9]{0,8})`;
const BOUND=1_000_000_000;

function unsupported(){
  return Object.assign(new Error("arithmetic_unsupported"),{
    code:"arithmetic_unsupported",statusCode:422
  });
}

function parseInteger(value){
  const number=Number(value);
  if(!Number.isSafeInteger(number)||Math.abs(number)>=BOUND)throw unsupported();
  return number;
}

export function solveGroundedArithmetic(prompt){
  if(typeof prompt!=="string"||prompt.length>128)throw unsupported();
  const text=prompt.trim().toLowerCase();
  if(!text)throw unsupported();

  const operatorPattern=new RegExp(
    `^(?:what is\\s+)?(${INTEGER})\\s*(\\+|\\-|\\*|plus|minus|times|multiplied by)\\s*(${INTEGER})\\s*\\??$`,
    "i"
  );
  const expression=operatorPattern.exec(text);
  let answer;
  let expressionType;
  if(expression){
    const left=parseInteger(expression[1]);
    const right=parseInteger(expression[3]);
    const operator=expression[2].toLowerCase();
    if(operator==="+"||operator==="plus")answer=left+right;
    else if(operator==="-"||operator==="minus")answer=left-right;
    else if(operator==="*"||operator==="times"||operator==="multiplied by")answer=left*right;
    else throw unsupported();
    expressionType="arithmetic";
  }else{
    const comparePattern=new RegExp(
      `^which(?:\\s+number)?\\s+is\\s+(larger|smaller),?\\s+(${INTEGER})\\s+or\\s+(${INTEGER})\\s*\\??$`,
      "i"
    );
    const compare=comparePattern.exec(text);
    if(!compare)throw unsupported();
    const a=parseInteger(compare[2]),b=parseInteger(compare[3]);
    // Equality isn't "larger" or "smaller"; do not guess.
    if(a===b)throw unsupported();
    answer=compare[1]==="larger"?Math.max(a,b):Math.min(a,b);
    expressionType="comparison";
  }
  if(!Number.isSafeInteger(answer)||Math.abs(answer)>=BOUND)throw unsupported();
  return Object.freeze({
    source:"hercules-deterministic-arithmetic",
    operation:expressionType,
    answer:String(answer),
    modelInferenceVerified:false,
    publicReleaseApproved:false,
    paidCommerceEnabled:false
  });
}
