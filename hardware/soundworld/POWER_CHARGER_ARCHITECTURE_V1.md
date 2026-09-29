# SoundWorld V1 — Charger, Battery & Power Architecture

Status: engineering architecture; thresholds are pre-EVT until validated.

## Charging
- USB-C Power Delivery architecture; 45 W design target.
- Negotiated input only; no assumption that an attached source can deliver target power.
- Charge-while-playing uses playback-priority derating rather than forcing full charge current through a thermally stressed system.
- Charging is locked out when battery temperature is outside the validated window.
- Connector, charger IC, battery and amplifier temperatures are independently considered in final firmware.

## Battery / BMS
Required protections: over-voltage, under-voltage, over-current, short-circuit, battery over/under-temperature and charger over-temperature.
Pack current/voltage and temperature telemetry are mandatory. Cell topology, chemistry, capacity and supplier remain unfrozen until amplifier rail and endurance testing are correlated.

## Fail-safe behavior
Unsafe telemetry or sensor failure must not silently enable charging. Brownout recovery must return to a known state. Protection limits cannot be disabled by Scene Mode or Hercules Link.

## Validation
Bench evidence required for charge time, charge while playing, connector heating, battery heating, cutoff behavior, cycle aging and brownout recovery. USB-C/PD interoperability is tested across representative compliant sources and cables.

## Customer package decision
Whether a wall power adapter ships in-box is a later commercial/regulatory decision. The speaker's required input profile and cable requirements must be clearly stated regardless.

No fast-charge time, battery runtime, supplied-adapter wattage or power-bank claim is authorized until production-equivalent validation.
