import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateBuildHandoff} from '../hardware/soundworld/evt-physical-handoff-v1.mjs';
const complete={bomFrozen:true,assemblySequence:true,interconnectSpec:true,unitIdentityPlan:true,instrumentationReady:true,safetyReview:true};
test('authorizes prototype handoff only with complete controlled package',()=>assert.equal(evaluateBuildHandoff(complete).authorized,true));
test('blocks handoff without interconnect definition',()=>assert.equal(evaluateBuildHandoff({...complete,interconnectSpec:false}).authorized,false));
test('never authorizes production or claims',()=>{const r=evaluateBuildHandoff(complete);assert.equal(r.productionAuthorized,false);assert.equal(r.claimReady,false);});