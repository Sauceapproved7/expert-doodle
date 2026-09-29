# SoundWorld V1 — Final Peripheral Parts Freeze 01

## Type-C protection
TPD4S201 is selected as the EVT Type-C port protection companion architecture for TPS25751. TI explicitly identifies TPD4S201 on the TPS25751EVM as a USB Type-C 20 V port protector with short-to-VBUS overvoltage and IEC ESD protection. Final schematic follows the applicable TI reference implementation and ratings.

## Temperature sensing
TMP117 selected for board/electronics temperature telemetry where its range/interface fit the final placement. Battery pack retains at least two dedicated pack temperature channels under BMS authority; board telemetry does not replace cell-region sensing.

## Connectors
Battery and speaker connector families may freeze only after current rating, contact resistance, mating cycles, polarization/keying, mechanical retention, temperature rise and supplier traceability are documented. This file does not invent an MPN without those mechanical/current inputs.

## Release reviews
PCB layout release requires:
1. schematic ERC clean or dispositioned,
2. power/ground current-path review,
3. RF reference-layout/antenna keep-out review,
4. thermal review for charger, regulators and amplifiers,
5. Type-C protection/reference-design review,
6. audio-clock and I2S timing review.

## Status
Peripheral architecture/components: substantially frozen for EVT.
ERC: pending.
RF review: pending.
Thermal review: pending.
PCB fabrication: not authorized.
Production: not authorized.
