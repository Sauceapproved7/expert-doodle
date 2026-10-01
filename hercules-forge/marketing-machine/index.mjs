export const MARKETING_SYSTEMS = Object.freeze([
  ["THE MACHINE","orchestration"],["Product Intelligence Engine","intelligence"],["Creative Lab","creative"],
  ["Offer Architect","offers"],["Ad Economics Calculator","economics"],["Landing-Page Killer","cro"],
  ["Retention Engine","retention"],["Creative Performance Brain","performance"],["Daily Command Center","command"],
  ["BLACKBOX","intelligence"],["Shadow Radar","public-competitive-intelligence"],["Creative DNA","knowledge"],
  ["Profit Sniper","profit"],["Customer X-Ray","voice-of-customer"],["Kill Switch","guardrails"],["THE LAB","experimentation"]
].map(([name,capability],i)=>Object.freeze({order:i+1,name,capability})));

export function buildMarketingMachineState(overrides={}) {
  return Object.freeze({
    schema:"sauceapproved.marketing-machine.state",
    version:1,
    mode:"observe",
    approvalRequired:true,
    systems:MARKETING_SYSTEMS,
    shopify:Object.freeze({connected:false,readEnabled:true,writeEnabled:false}),
    killSwitch:Object.freeze({enabled:true,failClosed:true}),
    ...overrides
  });
}

export function evaluateExperiment({hypothesis,control,variable,sampleSize=0,minSampleSize=100}={}) {
  if(!hypothesis||!control||!variable) return {ready:false,reason:"incomplete_experiment"};
  if(sampleSize<minSampleSize) return {ready:false,reason:"insufficient_sample"};
  return {ready:true,reason:"measurement_ready"};
}
