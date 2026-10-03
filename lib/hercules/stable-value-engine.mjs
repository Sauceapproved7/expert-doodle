export const WAD=10n**18n;
export const State=Object.freeze({BOOTSTRAP:"BOOTSTRAP",ACTIVE:"ACTIVE",GUARDED:"GUARDED",EMERGENCY:"EMERGENCY"});
const req=(c,m)=>{if(!c)throw new Error(m)};
export function mulDivDown(a,b,d){req(d>0n,"division_by_zero");return a*b/d}
export function validateOracle({priceWad,updatedAt,now,maxAge,deviationBps=0,maxDeviationBps=500}){
 req(priceWad>0n,"oracle_price_invalid");req(updatedAt<=now,"oracle_from_future");req(now-updatedAt<=maxAge,"oracle_stale");
 req(deviationBps<=maxDeviationBps,"oracle_divergent");return true;
}
export function collateralValueWad(collateralUnits,priceWad){return mulDivDown(collateralUnits,priceWad,WAD)}
export function collateralRatioBps({collateralUnits,priceWad,liabilitiesWad}){
 if(liabilitiesWad===0n)return 1_000_000n;
 return mulDivDown(collateralValueWad(collateralUnits,priceWad),10_000n,liabilitiesWad);
}
export function systemState({riskSupplyWad,seedThresholdWad,ratioBps,guardRatioBps,emergencyRatioBps,oracleHealthy=true}){
 if(!oracleHealthy||ratioBps<emergencyRatioBps)return State.EMERGENCY;
 if(riskSupplyWad<seedThresholdWad)return State.BOOTSTRAP;
 if(ratioBps<guardRatioBps)return State.GUARDED;
 return State.ACTIVE;
}
export function quoteMint({depositCollateralUnits,priceWad,feeBps=0n,minOutWad=0n}){
 req(feeBps>=0n&&feeBps<=1_000n,"fee_out_of_bounds");
 const gross=collateralValueWad(depositCollateralUnits,priceWad);
 const fee=mulDivDown(gross,feeBps,10_000n);const out=gross-fee;
 req(out>=minOutWad,"slippage");return{grossWad:gross,feeWad:fee,outWad:out};
}
export function canIncreaseRisk({state,collateralUnits,priceWad,liabilitiesWad,additionalLiabilityWad,minRatioBps}){
 req(state===State.ACTIVE,"risk_increase_disabled");
 const next=liabilitiesWad+additionalLiabilityWad;
 return collateralRatioBps({collateralUnits,priceWad,liabilitiesWad:next})>=minRatioBps;
}
