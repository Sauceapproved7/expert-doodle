# HURC Deployment Readiness Gate

This gate separates completed HURC source from an authorized blockchain deployment.

## Required before deployment approval

- [ ] Chain ID explicitly selected.
- [ ] Treasury address explicitly selected and independently verified.
- [ ] Initial whole-token supply explicitly selected.
- [ ] Exact source commit pinned.
- [ ] Owner-code-only gate passed.
- [ ] Provenance gate passed.
- [ ] Secrets scan passed.
- [ ] Contract compiled and behavior-tested with an appropriate Solidity toolchain.
- [ ] Deployment transaction cost and funding source known.
- [ ] Public distribution, sale, custody, tax, and regulatory requirements reviewed for the intended launch.
- [ ] Approved parameters recorded in `hercules-hurc/deployment.json` with status `deployment-approved`.

## Boundary

Changing the manifest to `deployment-approved` does not deploy HURC. Actual deployment requires an authorized wallet signature and network gas.

After deployment, record the contract address and transaction hash, change status to `deployed`, and preserve the exact source commit.

## Validation

```sh
node scripts/validate-hurc-deployment.mjs
node --test tests/hercules-hurc-deployment.test.mjs
```

## Current Base Sepolia testnet state

Completed:

- [x] Base Sepolia selected as the current test deployment target (chain ID `84532`).
- [x] Owner-code-only gate passed for HURC.
- [x] Provenance gate passed for HURC.
- [x] Secret scan passed for HURC.
- [x] HURC compiled successfully with the pinned Solidity compiler.
- [x] Contract surface and HURC test suite passed.
- [x] Hercules Browser integration deployed and recorded in `browser-runtime.json`.

Still required for an actual on-chain testnet deployment:

- [ ] Authorized EVM signer.
- [ ] Testnet treasury address controlled by that signer.
- [ ] Test ETH for Base Sepolia gas.
- [ ] Initial test supply selection.

No mainnet deployment is enabled by this state.
