# SoundWorld EVT-A Acoustic Model

Purpose: reject acoustically weak combinations before prototype tooling.

## First study point
Use the existing V1 envelope, not a claimed final configuration:
- gross enclosure study point: 7.5 L
- example occupied volume budget: drivers 0.4 L; passive radiators 0.3 L; battery 0.8 L; electronics 0.3 L; bracing/seals 0.4 L
- resulting example net acoustic volume: 5.3 L
- passive-radiator tuning study center: 53 Hz
- allowed tuning study window: 48–58 Hz

The model computes total driver swept-volume capability from effective cone area (Sd) and one-way linear excursion (Xmax). Candidate passive radiators must provide at least 2x the modeled driver displacement before EVT-A acceptance. This is a conservative screening rule, not a substitute for nonlinear simulation or measurements.

## Reject conditions
A candidate fails EVT-A screening when net acoustic volume falls outside 5.0–7.5 L, proposed tuning falls outside 48–58 Hz, or passive-radiator displacement is below the 2x screening margin.

## Required real inputs before freeze
Measured driver T/S data: Fs, Qes, Qms/Qts, Vas, Re, Le, Sd, Xmax; sensitivity and distortion sweeps.
Passive radiator: Sd, Mms/moving mass, Xmax, compliance and added-mass range.
Enclosure: true CAD-derived displaced volumes, leak behavior and panel/modal assessment.

## Next calculations
Once a candidate driver's measured T/S data exists: model system response, electrical impedance, cone excursion, passive-radiator excursion, group delay and limiter requirements versus input voltage. Then build EVT-A acoustic mule and correlate simulation against measurements.

No SPL, bass-extension, distortion, durability, ingress or runtime claim is authorized from this model.
