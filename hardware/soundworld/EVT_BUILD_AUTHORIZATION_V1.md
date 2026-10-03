# SoundWorld V1 — EVT Build Authorization Package

## Authorized scope
One or more engineering prototypes for measurement and correlation only. No sale, public performance claim, production order, certification mark, or promotional giveaway is authorized by this package.

## Controlled build inputs
Use the current architecture, acoustic shortlist, DVT interface, PCB/electrical architecture, enclosure constraints, power/charger safety policy and nonlinear excursion screen. Exact MPNs remain subject to qualification; substitutions must be recorded.

## Prototype configuration record
Every unit gets: unit ID; enclosure revision; active driver/tweeter/PR MPN and lot where available; PR added mass; amplifier/DSP/MCU/radio/charger/BMS/battery identity; PCB revision; firmware hash/version; gasket/seal revision; build date; deviations.

## Required instrumentation
Calibrated measurement microphone; audio analyzer/interface suitable for response/distortion; impedance measurement; voltage/current measurement; temperature sensing; excursion measurement method appropriate to driver/PR travel; USB-C PD analyzer; Bluetooth/link timing capture; scale for PR added mass.

## Test order
1. Visual/continuity/short inspection before battery connection.
2. Current-limited first power-up.
3. Charger/BMS/fault behavior.
4. Firmware identity and rollback.
5. Low-level channel/polarity verification.
6. Enclosure leak and impedance/tuning characterization.
7. 30–120 Hz stepped excursion/limiter sweep.
8. Full-band response, THD+N and compression.
9. Thermal/endurance.
10. Scene Mode invariant checks.
11. Hercules Link latency/drift/node-loss behavior.
12. Bluetooth range/reconnect/interoperability.
13. Drop/abrasion/ingress pre-compliance only after electrical/acoustic safety passes.

## Immediate stop conditions
Battery swelling/venting/abnormal temperature; charger or connector unsafe temperature; smoke/odor; repeated brownout; amplifier protection instability; driver/PR excursion beyond provisional margin; mechanical collision/noise; exposed conductor/short risk; firmware unable to restore last-known-good; protection override; non-repeatable dangerous behavior.

## Evidence required for DVT gate
Complete unit configuration; raw measurement files; calibration references; photos/fixture notes; pass/fail table; failure log and corrective action; repeat run after fixes; thermal map; charge/PD logs; excursion/limiter correlation; acoustic response/distortion/compression; firmware rollback evidence; Scene Mode safety invariants; Hercules Link timing evidence.

## DVT authorization
DVT remains blocked until measured EVT evidence exists, required tests repeatably pass, and open safety failures equal zero.

evtBuildAuthorizedByArchitecture: true
physicalBuildCompleted: false
dvtAuthorized: false
productionReady: false
claimReady: false
