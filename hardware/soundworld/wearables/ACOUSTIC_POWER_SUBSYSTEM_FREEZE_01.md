# SoundWorld Wearables — Acoustic + Power Subsystem Freeze 01

## Pods
Primary compute/audio: QCC7226-class Snapdragon S7 Gen 1 candidate.
Acoustic topology: one qualified micro-dynamic driver per bud, custom chamber/nozzle/vent geometry, measured in an ear simulator before MPN freeze.
ANC topology: external reference + internal feedback sensing per bud; dedicated voice pickup path. Exact MEMS parts require self-noise, AOP, sensitivity matching, current, port geometry and environmental qualification.
Power: miniature protected rechargeable cell per bud. Do not reuse 18650/21700 speaker-cell assumptions. Exact chemistry/form factor/capacity follows ergonomic, thermal, runtime and supplier-safety evidence.
Case: SauceApproved-owned charge supervision/state machine, protected case cell, USB-C, per-bud fault isolation and thermal telemetry.
Hearing/loudness safety outranks ANC, EQ, Sound DNA and Continuity.

## Max
Primary compute/audio: same QCC7226-class platform candidate to maximize shared firmware architecture.
Acoustic topology: qualified large dynamic driver per earcup, custom baffle/back-volume/vent/damping system. Diameter is deliberately unfrozen until FR/THD/compression/weight studies.
ANC/calls: multi-mic hybrid ANC plus voice beamforming geometry.
Power: service-oriented protected rechargeable battery sized only after measured platform + ANC + amplifier/runtime loads. No speaker battery is copied blindly.
USB-C charging plus wired fallback; exact analog/USB audio interface remains a qualification item.
Replaceable cushions remain part of the acoustic calibration model.

## Shared evidence gates
Physical coupler/head-fixture response; THD/compression; ANC attenuation vs frequency; transparency response; microphone SNR/AOP/wind behavior; RF/antenna coexistence; charge temperature; runtime; drop/sweat/environmental studies appropriate to product; signed-update/rollback proof.

No performance-superiority or battery/ANC claims before EVT measurements.
