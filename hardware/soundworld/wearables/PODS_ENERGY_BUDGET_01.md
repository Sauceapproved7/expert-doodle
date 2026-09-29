# SoundWorld Pods — Energy Budget 01

Status: pre-EVT engineering budget. This is a design control, not a runtime claim.
Date: 2026-09-29
Related freeze: PODS_BATTERY_CHARGING_FREEZE_01.md

## Cell basis
Primary EVT candidate: VARTA CoinPower CP1254 A4X
- nominal capacity: 74 mAh
- nominal voltage: 3.7 V

For pre-EVT budgeting, reserve 15% of nominal capacity for temperature, aging, protection cutoff, conversion loss, and manufacturing spread.

Budgeted usable capacity: **62.9 mAh**.

## Runtime current ceilings
To preserve the runtime targets with the 15% reserve:
- 8-hour target: total average bud current must be **<= 7.86 mA**
- 10-hour stretch target: total average bud current must be **<= 6.29 mA**

These are whole-bud ceilings, not SoC-only limits.

## Known published reference loads
### Qualcomm QCC7226-class S7 Gen 1
Qualcomm's current comparison material lists approximately:
- 3 mA base consumption
- 4 mA music streaming

These values are vendor platform references, not SoundWorld whole-product measurements.

### TDK T5837 microphone candidate
Per microphone, published typical current:
- high-quality mode: ~310 uA
- low-power mode: ~120 uA
- ultrasonic mode: ~500 uA

For a three-microphone bud in high-quality mode, microphone draw alone is approximately **0.93 mA** before rails/regulator loss.

## Preliminary streaming budget
Known reference basis only:
- QCC7226 music streaming reference: 4.00 mA
- three T5837 microphones in HQ mode: 0.93 mA
- subtotal: 4.93 mA

Remaining average-current envelope:
- against 8-hour target: **2.93 mA**
- against 10-hour stretch target: **1.36 mA**

The remaining envelope must cover the driver/output stage, wear sensor, touch/tactile interface, regulator losses, RF variation, ANC workload not already represented in the vendor reference, housekeeping, fault telemetry and other retained features.

## Design consequence
The 10-hour stretch target is intentionally hard. It cannot be treated as achieved from desk arithmetic. If the complete measured premium-use load exceeds 6.29 mA, the engineering team must improve efficiency, reconsider feature duty cycles, increase usable cell energy without violating fit/mass limits, or formally retain the 8-hour target. Runtime may not be protected by silently disabling required premium or safety behavior.

## Measurement matrix
Each left/right EVT bud must log:
1. deep idle
2. connected idle
3. music, ANC off
4. music, ANC on
5. transparency
6. voice call
7. spatial/head-tracked mode if retained
8. high-RF-interference condition
9. low-battery region
10. thermal-throttle region
11. charge-cycle recovery
12. Case Guardian fault/recovery event

Record average current, peak current, cell voltage, internal/board temperature, RF state, firmware hash and elapsed time.

## Pass criteria
- left/right current mismatch <= 5% in matched scenarios unless a documented role asymmetry explains it
- no unexplained thermal runaway trend
- no protection trip during validated peak load
- measured 8-hour premium-use target passes with reserve
- firmware update cannot increase measured average energy use above the approved release envelope without a new power review

## Sources
- VARTA Product Overview 2025: https://www.varta-ag.com/fileadmin/varta/industry/downloads/products/Product_Overview_2025_Web.pdf
- Qualcomm S7 Series: https://www.qualcomm.com/audio/products/snapdragon-s7-series
- TDK T5837: https://www.invensense.tdk.com/en-us/products/t5837
