# SoundWorld Speaker — BQ25792 to BQ25798 Migration Review 01

## Decision
Production charger anchor: **BQ25798RQMR**. BQ25792RQMR remains historical EVT/reference evidence only.

## Verified common envelope
TI documentation places BQ25792 and BQ25798 in the 29-pin 4 x 4 mm QFN family and lists the same 3.6–24 V operating input range and 5 A maximum charge-current class. Both support 1–4 series cells and I2C control.

## BQ25798 additions
BQ25798 adds MPPT and Backup Mode. Those features are not required to justify SoundWorld's charger choice and must not become marketing claims unless actually implemented and validated.

## TPS25751 integration
TI currently lists BQ25798 among the battery chargers controlled by TPS25751. TI's USB-PD-CHG-EVM-01 directly evaluates TPS25751 and BQ25798 together for 2–4-cell USB-C PD charging.

## Migration rule
This review does **not** declare BQ25798 a blind drop-in substitute. The production capture must use the BQ25798 pin map, register definitions, TPS25751 configuration and BQ25798 reference network. Legacy BQ25792 assumptions are not accepted without comparison.

## Release state
productionChargerFrozen: true
lifecycleHold: false
dropInAuthorized: false
ercReleaseReady: false
fabricationReady: false
purchaseAuthorized: false
productionReady: false
