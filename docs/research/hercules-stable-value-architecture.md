# Hercules Stable-Value Architecture Study

Status: research/design only — no production token deployment.

## Source pattern studied
USM ("Minimalist USD") separates a stable-value token from a funding/risk token and exposes four core state transitions: mint, burn, fund, and defund. Hercules adopts the *separation-of-responsibilities pattern*, not USM source code or its economics.

## Hercules-native architecture

### Components
1. **StableValueEngine** — deterministic accounting for collateral, liabilities, mint/burn quotes, and solvency.
2. **RiskBuffer** — separate junior-capital/risk layer; never silently socializes losses into stable balances.
3. **OracleGuard** — validates freshness, positive prices, deviation bounds, and multi-source agreement. Invalid/stale data fails closed.
4. **FeeController** — bounded, deterministic fees based on observable system state; no hidden admin override.
5. **InvariantMonitor** — exposes collateral ratio, liabilities, reserves, oracle age, and emergency state.
6. **EmergencyController** — may pause risk-increasing actions only. Redemption/risk-reducing paths remain separately specified and tested.

## Required invariants
- collateralValue >= protectedLiabilities under the configured safety threshold before any risk-increasing transition;
- oracle price > 0;
- oracle timestamp <= maxAge;
- mint/fund cannot execute while oracle validation fails;
- outputs must satisfy caller-provided min-out / max-in slippage limits;
- total accounting changes must reconcile exactly with minted/burned supply;
- no zero-supply division or bootstrap pricing path;
- risk-token bootstrap uses an explicit initial-price rule and minimum seed threshold;
- fee outputs are bounded by protocol constants;
- rounding direction must be deliberately conservative for the reserve;
- reentrancy cannot cross an external-value-transfer boundary;
- privileged actions cannot mint value, bypass collateral checks, or rewrite historical accounting.

## Improvements over the studied design
- Explicit bootstrap-state machine for zero/near-zero risk-token supply.
- Multi-source oracle policy with freshness + deviation checks.
- Circuit breaker for stale, zero, negative, or divergent price data.
- Conventional explicit function parameters for slippage rather than encoding min-out information inside transfer amounts.
- Standard, audited fixed-point math libraries rather than bespoke arithmetic where practical.
- Property/invariant testing as a release gate.
- Separate accounting engine from token interfaces so economics can be tested without ERC-20 transfer side effects.
- No production deployment until independent security review and economic stress testing pass.

## State machine
BOOTSTRAP -> ACTIVE -> GUARDED -> EMERGENCY

- BOOTSTRAP: risk buffer below seed threshold; stable mint disabled.
- ACTIVE: all invariants and oracle checks healthy.
- GUARDED: risk-increasing operations disabled when safety bands are approached.
- EMERGENCY: oracle or solvency invariant violated; fail closed on mint/fund and follow tested redemption policy.

## Test plan
### Unit
- mint/burn symmetry within documented rounding bounds
- fund/defund accounting
- stale/zero/divergent oracle rejection
- min-out enforcement
- fee caps
- bootstrap transition

### Property tests
- supply equals accounting liabilities after arbitrary valid operation sequences
- reserve cannot decrease from a rejected transaction
- no valid operation produces division by zero
- mint never reduces collateralization below configured threshold
- stale oracle can never authorize risk-increasing state changes

### Economic simulations
- 30/50/80% collateral price shocks
- oracle latency and temporary divergence
- rapid mint then burn
- near-zero risk-buffer supply
- liquidity exit / bank-run-style redemption sequence
- adversarial rounding sequences

## Release gate
This design remains simulation/testnet-only until:
1. invariants pass fuzz/property testing;
2. oracle failure drills pass;
3. economic stress tests have documented limits;
4. independent smart-contract security review is complete;
5. legal/regulatory review determines whether and how any stable-value or investment-like instrument may be offered.

## Provenance
Architecture derived independently from public design concepts. Do not copy GPL implementation code into proprietary Hercules components without a deliberate license decision.
