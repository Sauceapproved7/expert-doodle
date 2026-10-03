# SoundWorld V1 — Pack / Enclosure Reconciliation 01

The 4S2P P45B EVT pack changes the mechanical baseline.

Using manufacturer maximum cell dimensions and mass:
- 8 cells
- raw cell mass: 552 g at 69 g/cell (560 g if conservatively using the 70 g datasheet maximum)
- simple 4-by-2 raw cylindrical bounding block: 86.4 × 43.2 × 70.2 mm before spacing, insulation, holders, interconnects, BMS, sensors, service connector and impact structure
- preliminary cassette envelope with 6 mm gross allowance per side: 98.4 × 55.2 × 82.2 mm; this is a CAD reservation, not a final safe spacing prescription

## Consequences
The old 6–8.5 L gross enclosure study is reopened. Acoustic net volume must be preserved independently of battery/electronics volume. Battery cassette stays isolated from amplifier heat and passive-radiator sweep. Center of mass and drop loads must be recalculated. Service access cannot break the primary acoustic seal.

## Charger correlation
BQ25792 supports 4S charging to 16.8 V and programmable charge current up to 5 A. Charge-current policy will be capped by pack/cell thermal evidence and USB-C input power, not by IC maximum alone.

## Freeze status
Battery electrical topology: frozen for EVT study.
Cell candidate: frozen for EVT study.
Battery cassette external geometry: provisional.
Main enclosure CAD: REOPENED.
Acoustic net chamber: must be revalidated.
Production: blocked.
