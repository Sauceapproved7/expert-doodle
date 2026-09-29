# SoundWorld Speaker — EDA Release Control V1

## Purpose
Convert the already-merged SoundWorld speaker architecture into a real, auditable electronics design and fabrication package. Architecture documents are not PCB manufacturing files.

## Required source artifacts
- KiCad project (.kicad_pro)
- schematic (.kicad_sch)
- PCB layout (.kicad_pcb)
- exact BOM with manufacturer MPNs and DNP/variant state
- controlled design notes tying each critical circuit to manufacturer reference documentation

## Speaker implementation order
1. Power entry / 4S battery / protected system bus.
2. TPS25751 + BQ25792 USB-C PD/charger boundary.
3. digital rails.
4. nRF5340 RF/control reference region.
5. ADAU1467 DSP/audio clock region.
6. two TAS5825M stereo amplifier stages for four output channels.
7. telemetry/sensors/connectors/debug.
8. grounding, return-current, thermal and EMC review.
9. ERC.
10. PCB placement/routing and DRC.
11. fabrication outputs.

## TAS5825M control
Amplifier schematic/layout starts from TI's applicable TAS5825M datasheet/reference design. High-current output/decoupling loops, PowerPAD/ground copper and thermal paths must follow verified package/reference guidance; Hercules-specific four-channel integration remains separately reviewed.

## Fabrication outputs
Gerber/job files; Excellon drills; assembly drawings; BOM; component placement/pick-and-place; fabrication notes; board stackup/finish; checksum/release manifest.

## Fail-closed boundary
No fabrication package is released until ERC and DRC are clean or explicitly dispositioned, exact BOM is frozen, power/ground review passes, RF reference-layout review passes, thermal review passes, and all fabrication outputs are generated from the controlled PCB source.

No quote acceptance, purchase, PCB order, production, certification, sale or performance claim is authorized by EDA release.
