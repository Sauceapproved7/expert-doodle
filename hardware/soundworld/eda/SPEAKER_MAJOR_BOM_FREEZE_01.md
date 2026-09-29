# SoundWorld Speaker — Major EDA BOM Freeze 01

These are schematic anchors, not a complete fabrication BOM.

| Function | Candidate / family | Qty | Freeze state |
|---|---|---:|---|
| Stereo Class-D amplifier | TAS5825M | 2 | architecture frozen |
| DSP | ADAU1467 | 1 | architecture frozen |
| Wireless/control | nRF5340 | 1 | architecture frozen |
| USB-C PD policy | TPS25751 | 1 | architecture frozen |
| Charger/power path | BQ25792 | 1 | architecture frozen |
| Battery manager | BQ40Z50 family | 1 | family frozen; exact package/revision review remains |
| Board temperature | TMP117 | 1 | architecture frozen |
| Type-C protection | TPD4S201 | 1 | architecture frozen |

## Not yet frozen
All reference-design passives, crystals/oscillators, inductors, ferrites, FETs, current-sense parts, ESD details outside the selected Type-C protection block, exact connectors, programming/debug connector, antenna implementation, amplifier output networks, thermal interface materials and PCB stackup.

Each of those must be selected from the exact manufacturer reference design or calculated against the final rail/current/EMI requirements, then entered with exact manufacturer MPN.

## Capture order
Power/charging -> digital rails -> RF/control -> DSP/clock -> amplifiers -> sensors/connectors -> review/ERC -> placement/routing/DRC.

fabricationReady: false
purchaseAuthorized: false
productionReady: false
