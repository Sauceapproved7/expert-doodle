import {evaluateFinancialProductionReadiness} from "./production-readiness.mjs";

function clone(value){
  return value===undefined?undefined:structuredClone(value);
}

function controlState(ready,extra={}){
  return Object.freeze({ready:Boolean(ready),...extra});
}

export function buildFinancialReadinessDossier({
  complianceSummary,
  productionInputs={},
  qualificationEvidenceStatus=null,
  now=new Date().toISOString(),
}={}){
  const regulatedReadiness=(
    complianceSummary
    &&typeof complianceSummary==="object"
    &&complianceSummary.readiness
    &&typeof complianceSummary.readiness==="object"
  )
    ? complianceSummary.readiness
    : {ready:false,executionEnabled:false,blockers:["compliance readiness unavailable"]};

  const result=evaluateFinancialProductionReadiness({
    regulatedReadiness,
    transactionalStore:productionInputs.transactionalStore,
    secretCustody:productionInputs.secretCustody,
    recoveryEvidence:productionInputs.recoveryEvidence,
    caseOperations:productionInputs.caseOperations,
    providerCertification:productionInputs.providerCertification,
    now,
  });

  const details=result.details??{};
  const transactionalStore=details.transactionalStore;
  const secretCustody=details.secretCustody;
  const recovery=details.recovery;
  const caseOperations=details.caseOperations;
  const providerCertification=details.providerCertification;

  const qualificationBlockers=[];
  if(!qualificationEvidenceStatus||typeof qualificationEvidenceStatus!=="object"){
    qualificationBlockers.push("adapterQualification: qualification evidence is missing");
  }else if(qualificationEvidenceStatus.ready!==true){
    const supplied=Array.isArray(qualificationEvidenceStatus.blockers)&&qualificationEvidenceStatus.blockers.length
      ? qualificationEvidenceStatus.blockers
      : ["qualification evidence is not ready"];
    qualificationBlockers.push(...supplied.map((item)=>"adapterQualification: "+item));
  }
  const combinedBlockers=[...result.blockers,...qualificationBlockers];

  return Object.freeze({
    ready:combinedBlockers.length===0,
    activationAllowed:false,
    externalRailsEnabled:false,
    blockers:Object.freeze(combinedBlockers),
    controls:Object.freeze({
      regulatedMoney:controlState(details.regulated?.ready===true,{
        blockerCount:Array.isArray(regulatedReadiness.blockers)?regulatedReadiness.blockers.length:0,
      }),
      transactionalStore:controlState(Boolean(transactionalStore),transactionalStore?{
        id:transactionalStore.id,
        environment:transactionalStore.environment,
      }:{}),
      secretCustody:controlState(Boolean(secretCustody),secretCustody?{
        providerId:secretCustody.providerId,
        environment:secretCustody.environment,
      }:{}),
      recovery:controlState(Boolean(recovery),recovery?{
        restoreTestedAt:recovery.restoreTestedAt,
        rpoMinutes:recovery.rpoMinutes,
        rtoMinutes:recovery.rtoMinutes,
      }:{}),
      caseOperations:controlState(caseOperations?.ready===true,{
        controlCount:caseOperations?.controls?Object.keys(caseOperations.controls).length:0,
      }),
      providerCertification:Object.freeze({
        certified:providerCertification?.certified===true,
        blockerCount:Array.isArray(providerCertification?.blockers)?providerCertification.blockers.length:0,
      }),
      adapterQualification:controlState(qualificationEvidenceStatus?.ready===true,{
        stale:qualificationEvidenceStatus?.stale===true,
        identityChanged:qualificationEvidenceStatus?.identityChanged===true,
        qualifiedAt:qualificationEvidenceStatus?.qualifiedAt??null,
        expiresAt:qualificationEvidenceStatus?.expiresAt??null,
        blockerCount:Array.isArray(qualificationEvidenceStatus?.blockers)?qualificationEvidenceStatus.blockers.length:qualificationBlockers.length,
      }),
    }),
    compliance:Object.freeze({
      evidenceCount:complianceSummary?.evidence&&typeof complianceSummary.evidence==="object"
        ?Object.keys(complianceSummary.evidence).length
        :0,
      providerId:typeof complianceSummary?.provider?.id==="string"
        ?complianceSummary.provider.id
        :null,
      latestReconciliation:clone(complianceSummary?.latestReconciliation??null),
    }),
  });
}
