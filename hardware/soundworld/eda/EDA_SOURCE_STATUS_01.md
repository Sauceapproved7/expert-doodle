# SoundWorld Speaker V1 — EDA Source Status

Controlled KiCad source scaffold for the first owned speaker main-board implementation.

## Current state
- Project source exists.
- Schematic source exists.
- PCB source exists with a provisional EVT board outline only.
- No complete component placement.
- No routing.
- ERC not run.
- DRC not run.
- No Gerber/drill/placement outputs.
- Not for fabrication.

## Reference anchors
- Amplifier section: TI TIDA-060026 / TAS5825M reference-design family.
- USB-C/charger: TPS25751 + BQ25792 selected architecture.
- Wireless/control: nRF5340 reference-layout region required.
- DSP: ADAU1467 selected architecture.
- Protection/sensing and exact passives remain schematic-capture work.

## Next capture sequence
1. Power connector, 4S protected bus and input protection.
2. TPS25751/BQ25792 Type-C/charger block.
3. Digital rails.
4. nRF5340 control/RF block.
5. ADAU1467 clock/audio block.
6. Two TAS5825M stereo amplifier blocks.
7. Sensors, debug, speaker outputs and service connectors.
8. Net naming and power-flag audit.
9. ERC.
10. PCB placement/routing, then DRC.

Do not generate fabrication files until the existing EDA release gate is satisfied.
