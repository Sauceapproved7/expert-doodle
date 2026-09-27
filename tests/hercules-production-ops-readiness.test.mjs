import test from "node:test";
import assert from "node:assert/strict";
import {evaluateProductionOpsReadiness,REQUIRED_PRODUCTION_EVIDENCE} from "../hercules-runtime/production-ops-readiness.mjs";

const good=()=>Object.fromEntries(REQUIRED_PRODUCTION_EVIDENCE.map(k=>[k,{status:"VERIFIED",evidenceSha256:"a".repeat(64)}]));

test("complete production evidence can satisfy readiness gate",()=>{const r=evaluateProductionOpsReadiness({continuousTelemetry:true,evidence:good()});assert.equal(r.ready,true);assert.equal(r.disposition,"PRODUCTION_OPS_READY")});
test("sampled-only telemetry cannot satisfy production readiness",()=>{const r=evaluateProductionOpsReadiness({continuousTelemetry:false,evidence:good()});assert.equal(r.ready,false);assert.ok(r.reasonCodes.includes("CONTINUOUS_TELEMETRY_REQUIRED"))});
test("missing alert evidence blocks readiness",()=>{const e=good();delete e.alerting;const r=evaluateProductionOpsReadiness({continuousTelemetry:true,evidence:e});assert.equal(r.ready,false);assert.ok(r.missing.includes("alerting"))});
test("failed rollback evidence blocks readiness",()=>{const e=good();e.deployment_rollback={status:"FAILED",evidenceSha256:"b".repeat(64)};const r=evaluateProductionOpsReadiness({continuousTelemetry:true,evidence:e});assert.equal(r.ready,false);assert.ok(r.failed.includes("deployment_rollback"))});
test("invalid evidence digest blocks readiness",()=>{const e=good();e.production_slo_history={status:"VERIFIED",evidenceSha256:"bad"};const r=evaluateProductionOpsReadiness({continuousTelemetry:true,evidence:e});assert.equal(r.ready,false);assert.ok(r.invalidEvidence.includes("production_slo_history"))});
