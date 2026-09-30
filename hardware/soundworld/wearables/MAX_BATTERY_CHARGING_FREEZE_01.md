# SoundWorld Max — Battery / Charging Architecture Freeze 01

Status: EVT architecture freeze. This is an engineering control, not a customer-facing battery-life or charge-time claim.
Date: 2026-09-29
Owner-code scope: SauceApproved/Hercules SoundWorld.

## Decision

SoundWorld Max uses a **service-oriented protected rechargeable battery module** rather than a permanently bonded disposable pack.

### Primary EVT architecture
- 1S lithium-ion / lithium-polymer module, nominal 3.6–3.7 V class.
- 1,000–1,200 mAh nominal design window before final cell MPN freeze.
- Keyed service connector and mechanically captive pack.
- Hardware over-voltage, under-voltage, over-current and short-circuit protection.
- Dedicated pack temperature sensing under charge/discharge authority.
- Fuel-gauge / cycle-health telemetry available to firmware.
- USB-C protected charging path.
- Charging and playback may coexist only inside measured thermal and power limits.

The 1S architecture is the primary path because it preserves serviceability and keeps the headphone power domain separate from the higher-voltage portable-speaker pack. A 2S architecture is not authorized by default; it may be reconsidered only if the measured final amplifier/output-stage requirement cannot be met safely from the validated 1S rail architecture.

## Service boundary
Battery replacement must not require destructive enclosure damage. Replacement remains a qualified-service operation until electrical isolation, sealing, connector life, fastener retention and post-service Acoustic Twin recalibration are validated.

A replacement battery must carry exact cell/pack identity, lot traceability, protection revision and health baseline. Firmware must reject incompatible or unverified pack identity from fast-charge behavior.

## Charge / thermal policy
- No unrestricted fast-charge mode.
- Charge current is temperature-gated and derated when playback or Creator Monitor operation raises internal temperature.
- Faults fail closed on over-temperature, sensor disagreement, abnormal charge duration, over-current, short-circuit, pack-identity mismatch or repeated brownout.
- Hearing/loudness protection and thermal protection outrank ANC, EQ, Sound DNA, Acoustic Twin compensation and Creator Monitor.
- Wired/USB operation may reduce battery load but must not bypass battery or thermal protections.

## Hercules differentiators carried into power

### Acoustic Twin service continuity
Battery service and cushion service are logged independently from the factory acoustic fingerprint. A battery replacement cannot silently overwrite the factory acoustic reference. If service changes enclosure seal, mechanical fit or measured response, Acoustic Twin requires a new signed service calibration state.

### Creator Monitor power integrity
Creator Monitor records transport, calibration and power state so a neutral-monitor session cannot be represented as reference-grade if thermal throttling, low-battery voltage or an unqualified USB power path altered the approved operating envelope.

## EVT qualification gates
Before a production cell/pack MPN is frozen:
1. exact manufacturer and MPN
2. current technical data
3. applicable transport/safety evidence
4. lot/date traceability
5. charge/discharge limits
6. cycle-aging data
7. swelling/venting behavior
8. temperature limits
9. keyed connector and service-retention validation
10. actual-headphone thermal test during charge plus playback
11. runtime/current matrix across ANC, transparency, calls, wireless playback, wired/USB and Creator Monitor
12. post-service Acoustic Twin integrity check

## Next engineering action
1. Close the headband/cup battery volume and service path.
2. Select engineering sample cells/packs inside the 1,000–1,200 mAh design window.
3. Measure full-system current with the current QCC7226-class platform, ANC microphone array and output stage.
4. Run charge/playback thermal characterization.
5. Freeze the production pack MPN only after measured evidence passes.

productionReady: false
claimReady: false
