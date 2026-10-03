# Hercules SoundWorld Portable Speaker — EVT Prototype Specification V1

Status: EVT engineering build specification. Not a production or marketing specification.

## EVT objective
Build and instrument the first integrated SoundWorld prototype capable of validating acoustic architecture, electrical/thermal behavior, charging, DSP protection, Scene Mode and Hercules Link assumptions.

## Mechanical / acoustic package
- Gross enclosure study envelope: 6.0–8.5 L.
- Initial integrated study point: 7.5 L gross; target net acoustic volume approximately 5.0–7.5 L after measured component displacement.
- 2 x 70–80 mm long-excursion mid-bass driver class.
- 2 x 20–25 mm tweeter class.
- 2 opposed passive radiators.
- PR tuning study window: 48–58 Hz; 53 Hz initial study center.
- Internal bracing and gasket strategy required; enclosure leaks must be characterized.
- Candidate PR displacement must pass the Hercules displacement and excursion margins before acceptance.

## Amplification / DSP
- Independent Class-D channels.
- 80–120 W total short-term electrical design envelope; final continuous capability determined thermally.
- Dedicated audio DSP with crossover, EQ, excursion-aware bass management, peak/RMS limiting and thermal derating.
- Protection ceilings are immutable to user modes.

## Power / charging
- Protected rechargeable Li-ion architecture.
- Initial energy design class: 80–100 Wh, unfrozen.
- USB-C PD input architecture; 45 W design target.
- BMS protection: OV, UV, OC, short-circuit, battery over/under-temperature.
- Charge-while-playing must derate charging when thermal/power budget requires.
- Unsafe telemetry fails closed.

## Firmware
- Signed firmware.
- A/B or equivalent rollback-safe update path.
- Last-known-good recovery after failed update.
- Brownout-safe state recovery.
- No protection limit may be disabled by a consumer control.

## Hercules differentiators — mandatory EVT functions
### SoundWorld Scene Mode
Prototype must expose Cinema, Music, Voice, Outdoor and Night profiles. Profiles alter acoustic behavior inside shared immutable protection limits.

### Hercules Link
Prototype architecture must support synchronized group state with explicit roles: front, fill, dialogue-focus and bass-support. Design target is <1 ms long-term relative synchronization drift; this remains a target until measured.

## Instrumentation
EVT shall expose/log battery voltage/current/temp, charger state, amplifier temp, limiter activity, protection events, firmware version, Scene Mode and Hercules Link state. Test firmware may expose additional engineering telemetry not present in production UI.

## EVT-A measurements
1. Driver T/S verification: Fs, Qes/Qms/Qts, Vas, Re, Le, Sd, Xmax evidence.
2. Enclosure electrical impedance sweep and leak/resonance inspection.
3. Near-field driver and PR response.
4. Far-field frequency response under a documented geometry/environment.
5. Driver and PR excursion correlation versus model.
6. SPL + THD+N + compression versus frequency/level.
7. Limiter engagement/recovery and sub-tuning protection.
8. Amplifier/enclosure/battery thermal rise at sustained defined loads.
9. Battery endurance at defined program and SPL.
10. USB-C PD negotiation, charge time, charge-while-playing and connector temperature.
11. Bluetooth range/reconnect and representative interoperability.
12. Hercules Link latency/drift/node-loss recovery.
13. Scene Mode response/protection verification.
14. Firmware failed-update rollback and brownout recovery.

## Automatic reject conditions
Reject or redesign if any candidate requires disabling protection to meet output target; exceeds excursion/thermal/electrical limits; exhibits uncontrolled PR behavior; cannot recover safely from power/update faults; or only meets a desired claim under undocumented/nonrepeatable conditions.

## Exit criteria
EVT exits only when measured evidence identifies a viable acoustic platform, safe power/thermal envelope, repeatable DSP protection behavior, functional differentiators and a traceable list of unresolved DVT risks.

executionReady: false
productionReady: false
claimReady: false
