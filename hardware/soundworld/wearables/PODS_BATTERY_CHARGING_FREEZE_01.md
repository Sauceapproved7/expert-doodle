# SoundWorld Pods — Battery / Charging Architecture Freeze 01

Status: EVT candidate freeze; not production-certified and not a customer-facing runtime claim.
Owner-code scope: SauceApproved/Hercules SoundWorld.
Date: 2026-09-29

## Decision

SoundWorld Pods will use a dedicated miniature rechargeable cell architecture per bud. The portable-speaker 18650/21700 assumptions are explicitly prohibited for the Pods.

### Primary EVT bud-cell candidate
**VARTA CoinPower CP1254 A4X (63125)**

Manufacturer-published screening values:
- Nominal voltage: 3.7 V
- Nominal capacity: 74 mAh
- Diameter: 12.1 mm
- Height: 5.4 mm
- Mass: 1.8 g
- Published maximum discharge: 140 mA continuous / 210 mA for 2 seconds
- Published cycle reference: >500 cycles to >80% initial capacity
- Manufacturer provides CoinPower transport/safety documentation, including a UN 38.3 supplier test summary for CP1254 A4X.

Primary sources:
- https://www.varta-ag.com/fileadmin/varta/industry/downloads/products/Product_Overview_2025_Web.pdf
- https://www.varta-ag.com/rs/industry/smart-baby-monitor
- https://www.varta-ag.com/uk/industry/un-383-supplier-test-summary
- https://www.varta-ag.com/fileadmin/varta_microbattery/downloads/service/newsletter/2019/supplier-test-summary/coinpower/STS_CP1254A4_04.pdf

### Mechanical fallback candidate
**VARTA CoinPower CP1250 A4X (63121)**

Screening values:
- 3.7 V
- 62 mAh
- 12.1 mm diameter
- 5.0 mm height
- 1.6 g

Use only if the 5.4 mm CP1254 stack cannot close the earbud ergonomic, acoustic-chamber, antenna, or thermal envelope. A smaller cell is not accepted merely to simplify packaging.

## Platform load basis

SoundWorld Pods remain based on the QCC7226-class Snapdragon S7 Gen 1 architecture candidate. Qualcomm currently publishes a 3 mA base-consumption and 4 mA music-streaming reference for the S7-series comparison table, but those numbers are not whole-product current draw and must not be converted into a customer runtime claim.

TDK T5837 remains the first microphone candidate. Published current is approximately 310 uA in high-quality mode, 120 uA in low-power mode, and 500 uA in ultrasonic mode. Total system current must include all microphones, audio output stage, sensors, RF activity, regulators, ANC workload, memory, LEDs/haptics if retained, protection overhead, and cell aging.

Primary sources:
- https://www.qualcomm.com/audio/products/snapdragon-s7-series
- https://www.qualcomm.com/audio/products/snapdragon-s7-series/snapdragon-s7-gen-1-sound-platforms
- https://www.invensense.tdk.com/en-us/products/t5837
- https://invensense.tdk.com/wp-content/uploads/2022/08/DS-000447-T5837-v1.1.pdf

## Runtime gate

No battery-life number becomes customer-facing until measured on production-equivalent hardware.

EVT acceptance:
1. Instrument left and right buds independently.
2. Measure current in standby, music, call, transparency, ANC, peak-RF, and recovery modes.
3. Derate cell capacity for temperature, aging, regulator loss, protection cutoff, and manufacturing spread.
4. Require repeatable left/right runtime balance; one bud may not become the practical system limiter.
5. Target >= 8 hours continuous mixed premium use per charge before DVT; 10 hours is the stretch engineering target.
6. Reject any firmware feature that meets the runtime target only by silently disabling ANC, spatial processing, or required safety telemetry.

## Charging-case energy architecture

The case remains an active SoundWorld device, not a passive battery bucket.

EVT target:
- Protected 1S rechargeable lithium architecture.
- **700–900 mAh usable-capacity design window** before final MPN freeze.
- USB-C input with negotiated charging behavior.
- Independent left/right bud charging supervision.
- Case thermal sensing plus bud-temperature/fault telemetry.
- Charge-cycle accounting and cell-health history exposed to Case Guardian.
- Fail closed on over-temperature, sensor disagreement, over-current, abnormal charge time, or incompatible cell identity.
- No fast-charge marketing claim until temperature rise and cycle-life evidence exist.

The case capacity window is sized to support several full pair replenishments after realistic conversion, reserve, and aging losses; exact recharge-count claims wait for EVT measurement.

## Hercules differentiators carried into power

### 1. Case Guardian
The case tracks bud/case thermal behavior, charge imbalance, abnormal self-discharge, cycle accumulation, and recovery events. It can quarantine a suspect bud from charging rather than repeatedly energizing a fault.

### 2. Runtime Integrity
SoundWorld records measured energy behavior per firmware release so a feature update cannot silently cut runtime below the approved envelope. A release that violates the energy budget fails the release gate instead of hiding the regression.

## Supplier / safety gates

Before any cell is production-frozen:
- exact manufacturer and MPN
- current technical data sheet
- current UN 38.3 transport evidence
- lot traceability
- charge/discharge limits
- cycle-aging data
- swelling/venting behavior
- storage limits
- incoming inspection criteria
- approved second source or documented single-source risk
- bench validation inside the actual sealed mechanical stack

## Next engineering action

1. Fit-check CP1254 A4X inside the current Pod CAD envelope.
2. Build the complete current budget around QCC7226 + T5837 + output stage + sensors.
3. Select the case cell only after the case geometry and thermal model are loaded.
4. Run the first instrumented EVT discharge/charge matrix.
5. Freeze the production cell MPN only after the measured evidence passes.
