# SoundWorld Speaker — Exact Part / Footprint Freeze 01

## Evidence-backed exact anchors

### Amplifiers
**TAS5825MRHBT**, quantity 2.
TI identifies this orderable device as TAS5825M in the **RHB 32-pin VQFN** package. These two devices remain the four-channel amplifier architecture.

### USB-C PD controller
**TPS25751SRSMR**, quantity 1.
TI identifies this orderable TPS25751 variant in the **RSM 32-pin VQFN** package. TPS25751 also provides integrated I2C control support for BQ25792-class chargers.

## Package/family anchors still requiring exact implementation freeze
- BQ25792 charger: exact orderable suffix/package plus reference-design passives/power-stage calculation.
- ADAU1467 DSP: exact orderable model/package and CAD footprint import verification.
- nRF5340: exact SoC/package or qualified module decision; RF reference layout and antenna network must follow that decision.
- TMP117 and TPD4S201: exact suffix/package tied to availability and footprint review.

## Explicit HOLD items
Do not invent or generically assign:
- charger inductors/FETs/current-sense/compensation
- PD configuration and supporting passives
- RF matching/antenna network
- crystals/oscillators
- amplifier output EMI network
- exact connectors
- thermal-interface components
- final stackup-dependent RF/impedance geometry.

## ERC transition rule
The schematic is not ERC-ready merely because major ICs have packages. ERC-ready requires every placed symbol to have a verified pin map, power intent, no-connect intent, exact footprint, and required reference-design support network.

ercReady: false
fabricationReady: false
