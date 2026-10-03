# SoundWorld V1 — Schematic Interface Freeze 01

## Frozen interfaces
- Battery: owned 4S2P module, 14.4 V nominal, 4-series charge domain.
- Charger/power path: BQ25792, I2C supervised. TI specifies 1–4-cell buck-boost charging, NVDC power path, ADC telemetry, protection and USB-PD-compatible voltage ranges.
- Wireless/control: nRF5340. Nordic documents I2S master/slave, TX/RX, multiple sample widths and audio clocking.
- DSP: ADAU1467-class dedicated audio DSP.
- Amplification: four independently controlled channels through two TAS5825M-class stereo devices.
- Digital audio boundary: I2S between control/audio domains, exact master/clock ownership to be resolved with DSP/amp timing review.

## Power domains
PACK_4S protected battery bus.
SYS_AUDIO high-current amplifier domain.
SYS_CHG charger/system power path.
DIGITAL regulated control/DSP domain.
RF low-noise radio domain.
SENSE telemetry domain.
Ground/return topology is reviewed by current path and noise function; high-current switching returns must not share uncontrolled impedance with low-level clock/RF/sense returns.

## USB-C
BQ25792 is the charger/power-path device, not by itself the final complete Type-C policy implementation. Exact Type-C/PD controller, CC interface, receptacle protection, ESD and configuration are HOLD until an evidence-backed part/reference design is selected.

## Audio clocks
nRF5340 I2S supports master/slave operation and an audio PLL clock path. Final MCLK/LRCK/BCLK ownership and sample-rate family are frozen only after ADAU1467/TAS5825M interface timing is checked end-to-end.

## Protection / ESD / EMI
USB-C, user-accessible controls and external service interfaces require ESD protection. Switching-node loops are minimized; amplifier outputs/charger switching/RF antenna zones remain separated. Exact filters, TVS devices, inductors/capacitors and layout geometries come from exact component reference designs and pre-compliance measurements.

## Telemetry
Battery voltage/current/SOC; pack temperatures; charger state/fault; amplifier temperature/fault/limiter; board temperature where practical. Hardware safety retains authority over firmware.

## Remaining HOLD before schematic freeze
1. exact USB-C Type-C/PD policy/controller implementation
2. exact digital regulators and rail current budget
3. exact oscillator/clock implementation
4. connector/ESD/sensor MPNs
5. complete schematic peer review and ERC

interfaceFreezeReady: true
fullSchematicFrozen: false
pcbFabAuthorized: false
productionReady: false
