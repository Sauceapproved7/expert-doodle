# SoundWorld Speaker — BQ25798 Charger Migration Freeze 01

## Production decision
The production schematic target moves from BQ25792RQMR to **BQ25798RQMR**.

TI currently lists BQ25798 ACTIVE for 1–4-cell Li-ion/Li-polymer systems, up to 5 A charging, 3.6–24 V input, I2C control, and RQM 29-pin 4 x 4 mm VQFN-HR packaging. TI documents BQ25792/BQ25798 as pin/register compatible, and TPS25751 explicitly supports BQ25798. TI's USB-PD-CHG-EVM-01 evaluates TPS25751 + BQ25798 together for 2–4-cell USB-C PD charging.

## No blind swap
Compatibility evidence does not authorize an unchecked component substitution. Before ERC release the SoundWorld capture must review the current BQ25798 implementation for pin map, register assumptions, TPS25751 PD configuration, input/power-path topology, inductor/capacitor network, thermistor/thermal behavior, and the exact 4S charging policy.

Backup/dual-input and OTG/source functions remain disabled unless deliberately designed and validated.

## SoundWorld boundary
- battery: 4S2P
- nominal pack voltage: 14.4 V
- maximum pack charge voltage: 16.8 V
- USB-C PD engineering target: 45 W
- production charger target: BQ25798RQMR
- PD controller: TPS25751
- migration is controlled, not a drop-in assumption

captureFreezeReady: true
dropInAuthorized: false
ercValidated: false
fabricationReady: false
purchaseAuthorized: false
productionReady: false
