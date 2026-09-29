# SoundWorld Speaker — Digital Power / RF / DSP Capture Freeze 01

## Power tree
PACK_4S (14.4 V nominal) -> TPS62933 wide-input synchronous buck -> controlled low-voltage digital rail.
Low-voltage digital rail -> TPS62840 low-IQ RF-friendly buck -> nRF5340 radio/always-on rail where final voltage/current calculations fit.

TPS62840 is prohibited from direct PACK_4S connection.

## Control and radio
nRF5340 remains the control/radio anchor. Schematic/layout must preserve the exact applicable Nordic RF reference region, antenna keep-out, crystal requirements and decoupling. Hercules Link is application behavior above this hardware boundary.

## DSP and digital audio
ADAU1467 remains the dedicated audio DSP.
EVT audio family: 48 kHz.
12.288 MHz remains the master-clock study frequency.
Digital audio boundary: I2S/TDM-capable architecture.

Clock-master ownership is deliberately NOT frozen by this document. It must be reviewed end-to-end across nRF5340, ADAU1467 and TAS5825M before timing freeze.

## Physical partition
- switching regulator hot loops separated from RF and audio clocks
- RF antenna/reference region isolated from Class-D output loops
- DSP/control grounds return without uncontrolled high-current amplifier impedance
- test points for digital rails, MCLK/BCLK/LRCLK and I2C/SPI control where practical
- board temperature telemetry retained

## Status
captureReady: true
clockOwnershipReviewed: false
ercValidated: false
drcValidated: false
fabricationReady: false
