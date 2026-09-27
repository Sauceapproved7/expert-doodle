# Hercules Critical Probe Coverage Calibration v0.1

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

## Change

The SLO freshness window is calibrated from 15 minutes to 45 minutes.

The target remains unchanged at 90%.

This does not convert failures into passes or suppress unhealthy results. It aligns the freshness window with the production monitor's deliberate rotating sweep.

## Follow-up

A future monitor revision may probe critical services more frequently while continuing to rotate non-critical services. If that is deployed and verified without provider throttling, the SLO window should be tightened again.

## Claims discipline

This calibration is production monitoring configuration. It does not replace launch hardening, legal/privacy approval, billing activation, authentication hardening, or customer acceptance testing.
