# SoundWorld V1 — Nonlinear Pre-EVT Screen

Purpose: convert the catalog-based stack into a conservative measurement plan. This is not a nonlinear transducer simulator and does not predict customer-facing SPL.

## Safety envelope
Use 85% of measured Xmax as the provisional engineering ceiling for both active drivers and passive radiators. Any measured/simulated point above either ceiling fails.

For current study candidates:
- ND91-4 published Xmax 4.6 mm -> provisional 85% ceiling 3.91 mm.
- ND90-PR published Xmax 9 mm -> provisional 85% ceiling 7.65 mm.

## Provisional sub-tuning limiter
Until physical correlation exists, maximum voltage below the 53 Hz study tuning point follows a conservative squared frequency ratio:
Vmax(f) = Vbase * min(1, f/Fb)^2.
Above Fb it never exceeds Vbase. Final limiter tables must come from measured excursion, thermal and distortion data.

## Required sweep matrix
Test 30–120 Hz at stepped voltage. Retain per point: input Vrms, driver excursion, PR excursion, impedance, SPL, THD+N, limiter state, driver/amp temperature. Increase voltage only while all safety limits remain satisfied.

## Added-mass tuning
Record PR added mass and measured system impedance for each configuration. Freeze Fb only after impedance/acoustic measurements agree and the required excursion headroom exists across the intended operating range.

## Stop conditions
Stop increasing drive immediately on excursion-margin breach, abnormal mechanical noise, thermal limit, amplifier protection, unstable impedance behavior, or repeatability failure.

prototypeReady: false
productionReady: false
claimReady: false
