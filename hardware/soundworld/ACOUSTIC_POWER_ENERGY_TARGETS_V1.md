# SoundWorld V1 — Acoustic, Power & Energy Target Envelope

Status: pre-EVT engineering targets. These values drive simulation and prototype selection; they are not customer-facing claims.

## Acoustic topology target
- Configuration: stereo 2-way portable system.
- Mid-bass: 2 x nominal 70–80 mm long-excursion drivers.
- High frequency: 2 x nominal 20–25 mm tweeters.
- Low-frequency loading: 2 opposed passive radiators, mechanically arranged to reduce enclosure reaction force.
- Gross enclosure volume target: 6.0–8.5 L; net acoustic volume is established after battery, PCB, bracing and displacement modeling.
- Initial passive-radiator tuning study: 48–58 Hz. Final tuning comes from impedance/near-field measurements and excursion simulation.
- Crossover study region: 2.2–3.2 kHz, finalized from measured driver directivity/distortion.
- Protection: excursion-aware bass limiting + amplifier/driver thermal model + broadband peak limiter.

## Output target
Design objective: maintain useful bass and vocal clarity at sustained high output rather than optimizing a single peak-SPL number.
- Electrical amplifier design envelope: 80–120 W total short-term capability across independently controlled channels.
- Continuous thermal budget must be lower than peak electrical capability and established in sealed-enclosure thermal tests.
- No advertised wattage is authorized from this envelope.
- Max-SPL acceptance measurement: 1 m, defined environment, multiple frequencies/bands, with THD+N and compression reported beside SPL.

## Battery-energy model
Initial pack energy target: 80–100 Wh usable-design class, subject to transport/certification constraints and final mass target.
Example engineering budget, not a runtime claim:
- average mixed-program playback power at moderate level: 3–5 W system input
- elevated playback: 8–15 W
- sustained high output: materially higher and thermal-limited
- idle/connected target: <1 W
Runtime must be measured on production-equivalent hardware using a fixed program, volume/SPL, Scene Mode, firmware and battery revision.

## Power architecture
- USB-C PD input target: 45 W minimum design class; higher only if thermal and charge-time benefit justifies it.
- Charge and playback may coexist only inside verified connector/BMS/thermal limits.
- Optional power-bank output receives its own reserve floor so speaker shutdown protection remains deterministic.
- Battery temperature, pack voltage/current and amplifier temperature feed the protection controller.

## Hercules Scene Mode DSP constraints
Cinema: dialogue intelligibility + controlled low-frequency impact.
Music: neutral/balanced baseline with excursion-aware low-frequency extension.
Voice: speech-band clarity, reduced unnecessary bass energy.
Outdoor: compensation for perceived bass loss without defeating excursion/thermal protection.
Night: reduced low-frequency transmission and peak loudness while retaining dialogue clarity.

Every profile shares immutable safety ceilings.

## Hercules Link timing targets
- group clock discipline target: <1 ms long-term relative drift after synchronization.
- role-aware group profiles: front, fill, dialogue-focus, bass-support.
- graceful node loss: remaining speakers re-form topology without uncontrolled level jump.
- stereo/role assignments are explicit state, not inferred from user identity or microphones.

## Simulation / EVT decisions still required
1. Measure candidate driver T/S parameters and distortion.
2. Model sealed net volume and passive-radiator mass/tuning.
3. Model driver excursion versus frequency at each proposed limiter curve.
4. Establish amplifier efficiency and worst-case enclosure heat.
5. Establish battery pack voltage topology from amplifier rail requirements.
6. Validate mass, center of gravity, radiator reaction cancellation and drop loads.
7. Freeze acoustic/electrical targets only after EVT-A measurements.

## Evidence rule
A target becomes a specification only after the test method and tolerance are defined. A specification becomes a marketing claim only after production-equivalent verification evidence is retained.
