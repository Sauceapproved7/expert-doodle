# HURC — Hercules Coin

HURC is the owner-code-only utility-token foundation for the Hercules ecosystem.

## Canonical identity

- Name: `Hercules Coin`
- Symbol: `HURC`
- Standard surface: ERC-20 compatible
- Decimals: 18
- Source: `hercules-hurc/HURC.sol`
- Canonical repository: `Sauceapproved7/expert-doodle`

## Owner-code-only design

The contract is implemented directly in this repository and imports no third-party contract library. It contains its own transfer, approval, allowance, and transfer-from logic.

External blockchain nodes, wallets, explorers, Solidity compilers, and network infrastructure are infrastructure boundaries; they are not copied into or represented as Hercules-owned source.

## Supply model

HURC has no post-deployment mint capability.

At deployment, the constructor accepts:

1. a non-zero treasury address; and
2. the number of whole HURC tokens to create.

That amount is converted to 18-decimal units, created once, and assigned entirely to the treasury. The contract has no owner/admin role, upgrade hook, hidden mint path, or privileged transfer path.

This keeps the token supply decision outside source code until deployment approval.

## Compiler gate

HURC is pinned to Solidity `0.8.24+commit.e11b9ed9`. The contract workflow downloads the official static compiler, verifies its pinned SHA-256 before execution, generates deterministic Standard JSON input from the canonical source, compiles the contract, and validates the resulting ABI and bytecode.

No compiler package or third-party contract library is vendored into Hercules.

## Deployment readiness

Production deployment remains disabled.

The deployment planner currently permits only:

- Base Sepolia — chain ID `84532`
- Ethereum Sepolia — chain ID `11155111`

`hercules-hurc/deployment-request.template.json` intentionally leaves treasury and supply unset. `scripts/hurc-plan.mjs` validates the selected public testnet, treasury address, supply, and optional compiler bytecode, then creates unsigned deployment data.

The planner does **not** store private keys, sign transactions, broadcast transactions, or spend gas.

## Hercules Browser runtime

The HURC testnet preparation layer is integrated with the existing Hercules browser gateway. The live `hercules-hurc-browser` Edge Function is recorded in `hercules-hurc/browser-runtime.json`.

This browser layer discovers current Base Sepolia funding resources through Hercules-controlled browser infrastructure. It does not hold wallet private keys, sign transactions, or broadcast blockchain transactions.

## Deployment state

**Not deployed.**

The canonical deployment manifest remains `not-deployed` until the required deployment parameters are explicitly authorized. No mainnet contract address, treasury address, chain, or token-supply quantity is asserted by the repository.

## Intended Hercules utility

HURC is designed as a utility/payment layer that Hercules can later use for platform credits, service consumption, marketplace settlement, or other documented ecosystem functions. Business, tax, regulatory, custody, and distribution design must be completed before a public sale or production launch.

## Verification

```sh
node scripts/verify-owner-code-only.mjs
node scripts/validate-hurc-deployment.mjs
node --test tests/hercules-hurc-source.test.mjs
node --test tests/hercules-hurc-deployment.test.mjs
node --test tests/hercules-hurc-deployment-plan.test.mjs
node scripts/hurc-solc-input.mjs > /tmp/hurc-solc-input.json
```

The `HURC Contract Gate` performs the pinned compiler download, checksum verification, compilation, ABI/bytecode validation, and HURC test suite automatically.
