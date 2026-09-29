# SoundWorld Speaker — Four-Channel Amplifier Capture Freeze 01

## Architecture
Two TAS5825M stereo Class-D devices provide four independently controlled channels:
- AMP-A CH1 -> left mid-bass
- AMP-A CH2 -> right mid-bass
- AMP-B CH1 -> left tweeter
- AMP-B CH2 -> right tweeter

PVDD nominal system boundary: 14.4 V from the protected 4S system bus.
Digital audio/control is fed from the controlled DSP/audio domain.

## Protection authority
TAS5825M hardware protection and system thermal/battery safety remain above all user features.
Scene Mode, Sound DNA/Hercules processing and Hercules Link cannot disable:
- over-current protection
- cycle-by-cycle current limiting
- over-temperature warning/error handling
- under/over-voltage lockout
- speaker excursion/thermal protection policy
- system battery/thermal derating.

## Output network
Final LC/ferrite/output-filter values are NOT frozen. TI states output EMI filtering depends on system-level constraints. The final network requires exact driver impedance/load evidence, intended output power, cable/harness geometry and EMC pre-compliance.

## Layout controls
- local high-frequency PVDD decoupling at each device per manufacturer guidance
- minimize Class-D switching/output loop area
- thermal exposed-pad/copper/via implementation follows exact package guidance
- output loops separated from RF, audio clocks and high-impedance sensing
- each amplifier gets independent fault/warning observability
- speaker connectors keyed and channel-labeled
- no feature-layer routing around hard protection.

## Reference
Primary manufacturer anchors: TAS5825M current datasheet/EVM guidance and TIDA-060026 scalable digital-audio reference design. Hercules uses its own four-channel allocation; the reference design is engineering guidance, not copied product identity.

captureReady: true
outputNetworkFrozen: false
ercValidated: false
drcValidated: false
fabricationReady: false
productionReady: false
