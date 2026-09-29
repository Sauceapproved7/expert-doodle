# SoundWorld Speaker — Schematic Interconnect Review 01

## Captured architecture boundaries
1. Protected 4S2P battery/system bus.
2. TPS25751 + BQ25792 USB-C PD/charging boundary.
3. TPS62933 primary digital buck + TPS62840 downstream RF/low-power rail.
4. nRF5340 wireless/control.
5. ADAU1467 DSP.
6. Two TAS5825M devices / four output channels.
7. TMP117 + pack/charger/amplifier telemetry.
8. Controlled EVT service/debug and keyed output/service interfaces.

## Remaining before ERC-ready schematic revision
- import exact manufacturer symbols/footprints/packages
- exact reference-design passives and power-stage values
- exact crystals/oscillators and clock ownership
- exact inductors/FETs/current-sense/compensation for charger/power stages
- exact RF reference network/module decision and antenna implementation
- exact amplifier output EMI networks
- exact connector MPNs
- complete power flags/net labels/no-connect intent
- electrical-rule classification audit.

Until those are complete, this is an interconnect freeze, not an ERC pass and not a fabrication schematic.
