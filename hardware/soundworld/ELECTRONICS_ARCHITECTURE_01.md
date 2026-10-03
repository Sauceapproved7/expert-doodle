# SoundWorld V1 — Custom Electronics Architecture 01

## Board concept
One SauceApproved main electronics assembly plus the owned removable battery module. Functional partitioning may become multiple PCBs during layout if RF, thermal, serviceability or fabrication evidence requires it.

## Power tree
4S2P battery module -> protected 14.4 V nominal system bus.
System bus branches to:
1. four-channel audio power stage,
2. USB-C PD buck-boost charger/power path,
3. regulated digital rails for DSP/control/radio,
4. sensor/telemetry rails.
Playback-while-charging must preserve battery/BMS and thermal authority.

## Audio signal chain
Wireless/digital source -> nRF5340 control/radio domain -> ADAU1467 DSP domain -> four DAC/digital-audio amplifier paths -> 2 mid-bass + 2 tweeter channels.
Scene Mode executes in the DSP/control policy layer. Hard protection limits remain above presets.

## Amplification
Two TAS5825M-class stereo devices are the EVT architecture candidate, yielding four independently controlled output channels. Final gain, filter, output-network, PVDD decoupling, thermal copper and EMI network values require schematic/layout validation against the exact TI package/design guidance.

## Control / radio
nRF5340-class control/radio domain handles user controls, Hercules Link coordination, update orchestration and system state. RF layout follows the exact selected module/SoC antenna reference design; no antenna geometry is invented here.

## DSP
ADAU1467-class dedicated DSP owns crossover, EQ, Scene Mode, limiter coordination and measured calibration tables. DSP parameters cannot override battery, amplifier or thermal shutdown authority.

## Battery / charging
BQ40Z50-family pack manager provides pack telemetry/protection architecture. BQ25792-class charger/power-path interfaces USB-C power negotiation through the selected PD implementation. Exact PD controller/topology remains schematic freeze work.

## Sensors
Minimum telemetry: battery temperature, electronics/amplifier temperature, pack voltage/current/state-of-charge, charger state/faults, amplifier limiter/fault state. Additional board temperature and connector temperature channels are preferred where ADC/interface budget allows.

## Protection authority
1. physical fuse/secondary cell protection and hardware fault protection
2. BMS/charger/amplifier hardware safety
3. firmware safety supervisor
4. DSP limiter/crossover protection
5. Scene Mode
6. Hercules Link role behavior
Lower layers cannot be overridden by higher-numbered feature layers.

## Firmware/security
Signed firmware artifacts; rollback-safe update slots; version/hash recorded per EVT unit. Production debug access must be locked or authenticated. EVT service access is controlled and cannot expose customer credentials because none are required for bench operation.

## Board interfaces
Keyed battery connector; USB-C receptacle; four speaker outputs; temperature/sensor headers where required; control-button/status interface; controlled EVT debug/programming interface. Connector families/pin ratings remain exact-MPN freeze items.

## Schematic freeze requirements
Exact PD implementation; regulator selections; clocks; memory if required; audio bus format; amplifier gain/output filter; protection/fuse ratings; ESD/EMI components; connector MPNs; sensor MPNs; grounding/return strategy; RF reference implementation; creepage/clearance review; thermal calculation.

schematicArchitectureReady: true
pcbProductionAuthorized: false
productionReady: false
