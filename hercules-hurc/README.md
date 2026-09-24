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

## Deployment state

**Not deployed.**

No mainnet contract address, treasury address, chain, or token-supply quantity is asserted by this source foundation. Those are irreversible or financial deployment choices and require an authorized deployment transaction.

## Intended Hercules utility

HURC is designed as a utility/payment layer that Hercules can later use for platform credits, service consumption, marketplace settlement, or other documented ecosystem functions. Business, tax, regulatory, custody, and distribution design must be completed before a public sale or production launch.

## Verification

Run the repository owner-code verifier and HURC source test before deployment work:

```sh
node scripts/verify-owner-code-only.mjs
node --test tests/hercules-hurc-source.test.mjs
```
