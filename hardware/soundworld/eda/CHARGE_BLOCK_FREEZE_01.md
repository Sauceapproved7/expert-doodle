# SoundWorld Speaker — USB-C / 4S Charge Block Freeze 01

## Controlled architecture
USB-C receptacle -> Type-C protection -> TPS25751 PD policy -> BQ25792 buck-boost charger/power path -> protected 4S battery/system boundary.

Battery architecture remains 4S2P, 14.4 V nominal, 16.8 V maximum charge voltage.

## Required schematic interfaces
- TPS25751 owns USB-C PD policy/configuration.
- TPS25751 and BQ25792 are linked through the documented control interface.
- VBUS and CC protection follow the applicable TI reference implementation; no improvised Type-C protection values.
- BQ25792 battery/current/thermal limits remain below feature software authority.
- Pack manager telemetry/fault state is visible to the system safety supervisor.
- Playback-while-charging may derate charge current or playback load according to measured thermal/power evidence.
- Reverse-current, attach/detach, dead-battery and invalid-source behavior require bench validation.

## 45 W boundary
45 W is the engineering USB-C PD target, not a customer charging-speed claim. Final PDO configuration, cable/source compatibility and thermals require EVT evidence.

## Capture status
Circuit requirements frozen for schematic capture.
Exact passives, FETs, inductors, current-sense values, compensation and connector details must come from the exact selected package/reference-design calculations and remain BOM-controlled.

captureReady: true
ercValidated: false
pcbRouted: false
fabricationReady: false
purchaseAuthorized: false
