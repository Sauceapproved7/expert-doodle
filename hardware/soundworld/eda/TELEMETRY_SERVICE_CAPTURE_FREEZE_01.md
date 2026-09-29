# SoundWorld Speaker — Telemetry / Service Capture Freeze 01

## Telemetry
Required system-visible telemetry:
- TMP117 board/electronics temperature
- minimum two battery temperature channels from the protected pack architecture
- pack voltage/current/state-of-charge/fault telemetry
- charger state and fault telemetry
- four amplifier fault channels
- four amplifier limiter/protection-state channels where exposed by the selected control interface.

## Service / debug
EVT service access is allowed for controlled programming, logs and measurements.
It must not bypass:
- signed firmware verification
- rollback policy
- battery/BMS authority
- charger protection
- amplifier protection
- thermal shutdown/derating.

Production debug policy is locked or authenticated.

## Connector controls
- battery connector keyed, current-rated and retention-qualified
- four speaker-output channels keyed/labeled by function
- service/debug connector keyed and documented
- temperature/sense harnesses protected from high-current and Class-D routing
- exact connector MPNs remain qualification-controlled.

## Schematic net classes
Safety/power: PACK_4S, SYS_AUDIO, SYS_CHG, DIGITAL, RF, SENSE.
Telemetry/control: PACK_SMBUS, CHG_I2C, AMP_CTRL, AMP_FAULT, TEMP_BOARD, TEMP_PACK_A, TEMP_PACK_B.
Audio outputs: MB_L, MB_R, HF_L, HF_R.

captureReady: true
exactConnectorMpnFrozen: false
ercValidated: false
fabricationReady: false
productionReady: false
