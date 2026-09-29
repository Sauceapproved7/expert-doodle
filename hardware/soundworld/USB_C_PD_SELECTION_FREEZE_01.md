# SoundWorld V1 — USB-C PD Selection Freeze 01

## Selected EVT controller
TI TPS25751 paired with BQ25792.

Rationale: TI currently lists TPS25751 ACTIVE and explicitly documents integrated I2C control for BQ25792, USB Type-C PD power roles, PPS, protected managed power paths, and USB-IF PD certification. TPS25750 is explicitly not recommended for new designs, so it is rejected for SoundWorld V1.

## Intended SoundWorld behavior
- primary role: sink for speaker charging
- optional controlled source/DRP capability for power-bank behavior only after EVT validation
- charger: BQ25792
- owned 4S2P pack remains behind battery-management/protection authority
- PD configuration cannot override battery, charger or thermal safety limits

## Remaining evidence before full schematic freeze
Generate application-specific TPS25751 configuration using TI tooling/reference guidance; verify requested source/sink PDOs against connector, cable, charger, thermal and battery limits; bench-correlate attach/detach, dead-battery, invalid-source, overvoltage/reverse-current and playback-while-charging behavior.

controllerSelected: true
fullSchematicFrozen: false
pcbFabAuthorized: false
