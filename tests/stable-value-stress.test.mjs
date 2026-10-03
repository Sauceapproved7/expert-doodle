import test from "node:test";
import assert from "node:assert/strict";
import {WAD,State,collateralRatioBps,systemState,validateOracle,canIncreaseRisk} from "../lib/hercules/stable-value-engine.mjs";

const cfg={seedThresholdWad:WAD,guardRatioBps:15000n,emergencyRatioBps:11000n};

test("30/50/80 percent collateral price shocks never authorize risk increase outside ACTIVE",()=>{
  const liabilities=100n*WAD;
  const collateral=200n*WAD;
  for(const remainingPct of [70n,50n,20n]){
    const price=WAD*remainingPct/100n;
    const ratio=collateralRatioBps({collateralUnits:collateral,priceWad:price,liabilitiesWad:liabilities});
    const state=systemState({riskSupplyWad:10n*WAD,ratioBps:ratio,...cfg});
    if(state!==State.ACTIVE){
      assert.throws(()=>canIncreaseRisk({state,collateralUnits:collateral,priceWad:price,liabilitiesWad:liabilities,additionalLiabilityWad:WAD,minRatioBps:15000n}),/risk_increase_disabled/);
    }
  }
});

test("oracle latency boundary is deterministic and stale data fails closed",()=>{
  assert.equal(validateOracle({priceWad:WAD,updatedAt:900,now:1000,maxAge:100}),true);
  assert.throws(()=>validateOracle({priceWad:WAD,updatedAt:899,now:1000,maxAge:100}),/oracle_stale/);
});

test("divergent oracle moves system to emergency when health signal is false",()=>{
  assert.throws(()=>validateOracle({priceWad:WAD,updatedAt:1000,now:1000,maxAge:100,deviationBps:501,maxDeviationBps:500}),/oracle_divergent/);
  assert.equal(systemState({riskSupplyWad:10n*WAD,ratioBps:20000n,oracleHealthy:false,...cfg}),State.EMERGENCY);
});

test("near-zero risk supply remains bootstrap even with excess collateral",()=>{
  for(const supply of [0n,1n,WAD-1n]){
    assert.equal(systemState({riskSupplyWad:supply,ratioBps:50000n,...cfg}),State.BOOTSTRAP);
  }
});

test("grid invariant: authorization implies post-action collateral ratio meets minimum",()=>{
  for(let collateral=1n;collateral<=40n;collateral++){
    for(let liabilities=1n;liabilities<=40n;liabilities++){
      for(let add=1n;add<=5n;add++){
        const ok=canIncreaseRisk({state:State.ACTIVE,collateralUnits:collateral*WAD,priceWad:WAD,liabilitiesWad:liabilities*WAD,additionalLiabilityWad:add*WAD,minRatioBps:15000n});
        if(ok){
          const post=collateralRatioBps({collateralUnits:collateral*WAD,priceWad:WAD,liabilitiesWad:(liabilities+add)*WAD});
          assert.ok(post>=15000n);
        }
      }
    }
  }
});
