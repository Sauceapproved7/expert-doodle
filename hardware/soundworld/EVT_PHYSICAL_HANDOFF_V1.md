# SoundWorld V1 — Physical EVT Handoff

## Scope
Controlled engineering prototypes only. This package does not authorize a production run, public claims, retail sale, or component purchase.

## Prototype quantity
Build target: 3 EVT units after exact component MPNs and supplier availability are approved.
- EVT-001: acoustic/impedance/excursion correlation
- EVT-002: power/thermal/charging/endurance
- EVT-003: Hercules Link/Scene Mode/firmware/reliability
Units may cross-test after baseline characterization.

## Per-unit acoustic BOM
- 2 qualified 70–90 mm mid-bass drivers
- 2 qualified 20–25 mm tweeters
- 2 opposed qualified passive radiators
- sealed enclosure revision with removable service access
- gaskets, fasteners, damping and internal harness retained by revision

## Electronics
- four amplifier output channels
- dedicated audio DSP
- control/wireless MCU/SoC
- USB-C PD input/power path
- protected battery pack + BMS/fuel gauge
- temperature sensing for battery and amplifier region
- service/debug interface inaccessible in normal consumer operation

## Interconnect rules
Keyed/polarized connectors where practical; no exposed energized conductors; strain relief at battery, USB-C and transducer harnesses; speaker polarity recorded; battery disconnect accessible before service; RF antenna keep-out preserved; power and sensitive audio routing physically separated where practical.

## Assembly sequence
1. Record enclosure/PCB/component revisions and unit ID.
2. Inspect bare enclosure, seals, inserts and impact clearances.
3. Install passive radiators and acoustic seals.
4. Install drivers/tweeters with recorded polarity.
5. Install PCB, thermal interfaces and RF assembly.
6. Route/secure harnesses and verify service disconnect.
7. Install battery only after continuity/short inspection.
8. Current-limited first power.
9. Load signed EVT firmware and record hash.
10. Low-level channel/polarity test.
11. Seal enclosure; record fastener/gasket revision.
12. Run leak/impedance/tuning baseline before high-level acoustic testing.

## Acceptance before energized acoustic sweep
No shorts; correct rails; charger/BMS fault behavior sane; telemetry available; firmware identity/rollback verified; all channels correct; no abnormal current/temperature/noise; enclosure tuning measured and recorded.

## Evidence packet
For every unit retain photos, serial/unit ID, exact BOM/lot where available, firmware hash, PR added mass, enclosure revision, calibration references, raw measurements, failure log and corrective actions.

## Hard boundary
Any substitution changes the unit configuration record and may require regression. DVT stays blocked until EVT evidence is measured, repeatable, and has zero open safety failures.

physicalBuildCompleted: false
purchaseAuthorized: false
productionAuthorized: false
claimReady: false
