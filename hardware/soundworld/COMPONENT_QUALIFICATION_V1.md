# SoundWorld V1 — Component Qualification Matrix

No exact component is frozen by this document. A candidate must clear every hard gate and then be verified on EVT/DVT hardware.

| Class | Required engineering evidence |
|---|---|
| Mid-bass driver | measured T/S, Xmax method, sensitivity, distortion/compression, thermal rating, CAD |
| Tweeter | impedance, sensitivity, distortion, thermal rating, usable crossover region, CAD |
| Passive radiator | Sd, moving mass, compliance, Xmax, mass-adjust range, CAD |
| Class-D amplifier | rail/load compatibility, continuous/peak current, efficiency/thermal data, protection behavior, noise/distortion |
| Audio DSP | channel/I-O capacity, sample-rate/latency budget, limiter/EQ capability, deterministic firmware support |
| Control MCU | secure boot/update path, rollback support, telemetry/I-O capacity, lifecycle |
| Bluetooth/radio | required audio/link capability, antenna guidance, coexistence, firmware support, qualification/compliance path |
| USB-C PD charger | 45 W design-class negotiation, power-path support, protections, thermal data, interoperability |
| BMS/fuel gauge | cell topology compatibility, OV/UV/OC/short/temp protection, telemetry, fault behavior |
| Battery pack | energy/current capability, protection integration, cycle/thermal data, dimensional/swelling envelope, transport/compliance evidence |

## Hard gates
Electrical headroom; thermal evidence; lifecycle/availability; firmware/support path where applicable; compliance path; interface compatibility; acceptable sourcing risk. A weighted score cannot override a failed hard gate.

## Scoring after hard gates
Engineering fit 30; measured performance 25; thermal/power efficiency 15; lifecycle/support 10; compliance maturity 10; sourcing resilience 10. Minimum desk-qualification score: 75/100.

## Selection sequence
1. Gather manufacturer-controlled datasheets and qualification evidence.
2. Reject missing hard-gate evidence.
3. Score surviving candidates.
4. Obtain engineering samples only after shortlist approval.
5. Measure candidates in the SoundWorld EVT enclosure/electrical platform.
6. Freeze exact MPN only after correlation and regression checks.
7. Record approved alternates separately; no silent substitutions.

## Claim boundary
Datasheet values are selection inputs, not SoundWorld product claims. Finished-product claims require production-equivalent SoundWorld measurements.

productionReady: false
claimReady: false
