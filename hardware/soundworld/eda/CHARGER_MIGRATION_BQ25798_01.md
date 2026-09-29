# SoundWorld Speaker — BQ25792 to BQ25798 Migration Freeze 01

## Decision
Production charger candidate is migrated from BQ25792RQMR to **BQ25798RQMR**.

## Evidence-backed common envelope
TI documents BQ25792 and BQ25798 in the same 29-pin 4 mm x 4 mm QFN family. Both are 1-to-4-cell buck-boost chargers. BQ25798 supports 3.6 V to 24 V input and up to 5 A charging. It adds MPPT and Backup Mode relative to BQ25792.

## TPS25751 integration
TI currently lists BQ25798 among battery chargers controlled by TPS25751 over I2C. TI also provides USB-PD-CHG-EVM-01 specifically combining TPS25751 with BQ25798 for 2-to-4-cell USB-C PD charging.

## Migration controls
This is NOT declared a blind drop-in substitution. The production capture requires:
- pin-map review against the selected RQM package
- register/configuration review
- TPS25751 PD configuration revalidation
- reference-network review against current TI BQ25798 guidance
- 4S / 16.8 V maximum-pack policy retained
- system thermal, battery and hardware protection remain above feature software.

The BQ25798-only MPPT and Backup Mode capabilities are disabled/unclaimed unless separately designed, tested and approved.

## Gate state
productionChargerFrozen: true
dropInAuthorized: false
ercReleaseReady: false
fabricationReady: false
purchaseAuthorized: false
productionReady: false

The charger lifecycle hold is resolved at the component-selection layer. ERC release remains blocked by exact schematic capture, CAD validation and electrical-rule verification.
