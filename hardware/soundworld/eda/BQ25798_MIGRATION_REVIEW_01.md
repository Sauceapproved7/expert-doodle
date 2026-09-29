# SoundWorld Speaker — BQ25792 to BQ25798 Migration Review 01

## Decision
Select **BQ25798** as the production-direction charger candidate. Retain BQ25792 only as historical EVT/reference context.

## Verified common architecture
TI documents both BQ25792 and BQ25798 as 29-pin, 4 mm x 4 mm QFN-family devices with the same listed 26 V default ACOVP and 7/12/22/26 V ACOVP options.
BQ25798 is an active 1-4-cell, 5 A I2C buck-boost charger with 3.6-24 V operating input and up to 18.8 V charge-voltage capability, covering the SoundWorld 4S / 16.8 V maximum-charge architecture.

## TPS25751 compatibility
TI's current TPS25751 product documentation lists BQ25798 among chargers supported through integrated I2C control.
TI's USB-PD-CHG-EVM-01 evaluates TPS25751 and BQ25798 together for 2-4-cell USB-C PD charging.

## Added BQ25798 capabilities
Relative to the BQ25792 comparison table, BQ25798 adds MPPT and Backup Mode. These are not automatically exposed as SoundWorld customer features. They remain disabled/unclaimed unless system requirements justify and validate them.

## No blind drop-in rule
Same package class does NOT authorize schematic substitution.
Before the migration is capture-frozen:
1. verify every pin assignment against both current datasheets;
2. compare register maps/defaults and firmware configuration;
3. capture the current BQ25798 reference power network;
4. revalidate TPS25751 firmware/configuration;
5. verify 4S charge-voltage/current limits and thermistor policy;
6. bench-test attach/detach, invalid source, dead battery, playback+charge, supplement mode, thermal derating and reverse-current behavior.

migrationSelected: true
pinMapVerified: false
registerMapVerified: false
referenceNetworkCaptured: false
dropInAuthorized: false
lifecycleHold: true
ercReleaseReady: false
fabricationReady: false
