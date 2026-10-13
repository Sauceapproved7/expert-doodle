import {createHash} from 'node:crypto';
import {normalizeDeploymentRequest} from '../schema.mjs';

const schema='hercules.cloud.preflight.v1';
function privateTarget(target){
 return target && typeof target==='object'
   && target.verified===true
   && target.environment==='sandbox'
   && target.incrementalMonthlyCostUsd===0;
}
export function preflightCloudDeployment(input,{targets=[]}={}){
 const request=normalizeDeploymentRequest(input);
 if(!Array.isArray(targets)||targets.length>100)throw new TypeError('targets inventory invalid');
 const match=targets.find(t=>t?.kind===request.target.kind&&t?.reference===request.target.reference);
 const costOk=Boolean(match&&match.incrementalMonthlyCostUsd===0);
 const isolated=Boolean(match&&match.environment==='sandbox');
 const identity=Boolean(match&&match.verified===true);
 const controls=Object.freeze([
   {id:'artifact_proof',passed:true,notice:'Exact source commit and SHA-256 artifact fingerprint supplied; signing and provenance not yet independently attested.'},
   {id:'target_registered',passed:Boolean(match),notice:'Target must already exist in an independent owner-controlled registry.'},
   {id:'isolated_target',passed:isolated,notice:'Only isolated sandbox hosts may enter planning.'},
   {id:'verified_target',passed:identity,notice:'The server-side target record must be explicitly verified.'},
   {id:'zero_new_cost',passed:costOk,notice:'Incremental monthly cost must be a verified numeric zero; no provider bill is inferred.'},
 ]);
 const reasonByControl={
   target_registered:'target_not_registered',
   isolated_target:'target_not_isolated',
   verified_target:'target_not_verified',
   zero_new_cost:'unverified_zero_cost'
 };
 const blockedReasons=controls.filter(c=>!c.passed).map(c=>reasonByControl[c.id]);
 const readyForStaging=Boolean(match)&&privateTarget(match);
 const requestDigest=createHash('sha256').update(JSON.stringify({
   serviceId:request.serviceId,releaseId:request.releaseId,
   sourceCommit:request.sourceCommit,artifactFingerprint:request.artifactFingerprint,
   publicOrigin:request.publicOrigin,target:request.target
 })).digest('hex');
 return Object.freeze({
   schema,mode:'isolated-preflight',product:'Hercules Cloud',
   serviceId:request.serviceId,releaseId:request.releaseId,
   sourceCommit:request.sourceCommit,
   artifactFingerprint:request.artifactFingerprint,
   target:{kind:request.target.kind,reference:request.target.reference},
   requestDigest,
   readyForStaging,
   blockedReasons,
   controls,
   costChangeUsd:costOk&&isolated&&identity?0:null,
   executionAuthorized:false,
   productionAuthorized:false,
   rollbackExecuted:false,
   launchApproved:false,
   nextStep:readyForStaging
     ? 'Owner review of a separately deployed sandbox executor and rollback proof.'
     : 'Register and independently verify an isolated zero-increment-cost target.',
   limitation:'Preflight produces no container, DNS, checkout, secrets, deployment, order, or payout change.'
 });
}
