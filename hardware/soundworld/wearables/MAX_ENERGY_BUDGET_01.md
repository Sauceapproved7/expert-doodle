# SoundWorld Max — Energy Budget 01

Status: pre-EVT engineering budget. This is not a customer runtime claim.
Date: 2026-09-29
Related freeze: MAX_BATTERY_CHARGING_FREEZE_01.md

## Budget basis
Use a conservative **1,000 mAh nominal** EVT reference inside the approved 1,000–1,200 mAh architecture window.

Reserve 15% for temperature, aging, protection cutoff, conversion loss, cell spread and service-life margin.

Budgeted usable reference capacity: **850 mAh**.

The larger 1,200 mAh end of the architecture window may improve measured headroom, but no runtime number is authorized from capacity arithmetic alone.

## Runtime current ceilings
Using the 850 mAh conservative usable reference:
- 30-hour premium-use target: whole-headphone average current must be **<= 28.33 mA**
- 40-hour stretch target: whole-headphone average current must be **<= 21.25 mA**

These ceilings include the complete active system: audio platform, RF, microphones, ANC/transparency processing, output stage, sensors, regulator losses, telemetry and user-interface loads.

## Required operating scenarios
Instrumented EVT measurements must cover:
1. deep idle
2. connected idle
3. wireless music, ANC off
4. wireless music, ANC on
5. transparency
6. voice call / beamforming
7. high-RF-interference condition
8. wired analog fallback where implemented
9. USB audio / powered mode where implemented
10. Creator Monitor neutral-reference path
11. Acoustic Twin recalibration
12. low-battery region
13. thermal-derated region
14. charge plus playback
15. firmware rollback and recovery

Record average and peak current, cell voltage, pack temperature, electronics temperature, RF state, firmware hash, calibration state and elapsed time.

## Runtime Integrity gate
A firmware release must not silently reduce validated runtime below the approved envelope.

If a new ANC, Sound DNA, Continuity, Acoustic Twin or Creator Monitor revision raises average energy use beyond the approved release budget, the release is blocked until one of the following is documented:
- efficiency improvement restores the envelope;
- feature duty-cycle or implementation is changed without disabling required safety/premium behavior;
- validated cell energy is increased inside the mechanical/thermal architecture;
- the engineering runtime target is formally revised before marketing claims exist.

## Thermal / service coupling
The energy gate is invalid if it passes only while the product exceeds the approved temperature envelope, disables protection, uses an unqualified battery, or bypasses the serviceable-pack identity checks.

Cushion replacement, battery replacement and any enclosure service that changes measured acoustic or thermal behavior require the relevant Acoustic Twin/service checks before the previous runtime evidence is reused.

## Pass criteria
- 30-hour target passes on production-equivalent hardware with the defined reserve
- 40-hour stretch target is separately reported and never implied if it does not pass
- no protection trip during validated peak load
- no unexplained thermal runaway trend
- no firmware regression outside the approved release budget
- low-battery behavior preserves hearing/loudness and thermal protections
- Creator Monitor reports degraded power/thermal state rather than presenting a false neutral-reference condition

No customer-facing runtime number becomes authorized until production-equivalent hardware repeats the approved matrix.
