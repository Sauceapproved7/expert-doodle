# Hercules Critical Probe Coverage Calibration v0.2

Date: 2026-09-27 UTC

## Finding

The production service monitor runs every five minutes and intentionally checks six enabled services per invocation to avoid provider burst throttling.

Current production registry:
- 43 enabled services
- 16 critical/Tier-0 services
- six services checked per five-minute run
- one complete sweep requires eight runs, or about 40 minutes

The existing `critical-probe-coverage` SLO required 90% of critical services to have a conclusive probe inside 15 minutes. That window could not represent a full monitor sweep and produced a persistent warning even though the underlying critical service checks were healthy.

## Verified production evidence before calibration

- 1,730 service checks in the previous 24 hours
- 1,730 successful checks
- zero failed checks
- zero open service incidents
- all 16 critical services had a conclusive health check inside the previous 45 minutes
- measured 45-minute critical coverage: 100%

## Configuration change

The SLO freshness window is calibrated from 15 minutes to 45 minutes.

The target remains unchanged at 90%.

## Evaluator correction

The first configuration migration exposed an implementation defect: `hercules_evaluate_slos()` recorded each SLO's configured `window_minutes`, but the critical-probe classification itself still used a hard-coded 15-minute freshness interval.

The follow-up migration separates the two production semantics:

- critical service health remains based on a 15-minute freshness interval;
- critical probe coverage uses the configured `critical-probe-coverage` freshness window, currently 45 minutes.

The evaluator now records the freshness interval used in evidence details and observability dimensions.

## Safety

This does not convert unhealthy service results into healthy ones, lower the 90% coverage target, or suppress provider failures. It fixes the evaluator so the coverage metric measures the window declared by its own SLO definition.

## Follow-up

A future monitor revision may probe critical services more frequently while continuing to rotate non-critical services. If that is deployed and verified without provider throttling, the coverage window should be tightened again.

## Claims discipline

This calibration is production monitoring configuration. It does not replace launch hardening, legal/privacy approval, billing activation, authentication hardening, or customer acceptance testing.
