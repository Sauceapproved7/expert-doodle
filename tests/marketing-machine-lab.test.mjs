import test from "node:test";
import assert from "node:assert/strict";
import {createExperiment,concludeExperiment} from "../hercules-forge/marketing-machine/lab.mjs";
test("THE LAB refuses early conclusions",()=>{const e=createExperiment({hypothesis:"H",control:"A",variable:"B",successMetric:"CVR",minSampleSize:100});assert.equal(concludeExperiment(e,{sampleSize:20,result:"variable"}).status,"collecting")});
test("THE LAB records evidence after sample gate",()=>{const e=createExperiment({hypothesis:"H",control:"A",variable:"B",successMetric:"CVR",minSampleSize:100});const x=concludeExperiment(e,{sampleSize:100,result:"variable",lesson:"B won"});assert.equal(x.status,"complete");assert.equal(x.winner,"variable")});
