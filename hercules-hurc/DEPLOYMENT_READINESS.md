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
