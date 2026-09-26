# Hercules ERC-4337 Smart Account

This module adds the owner-code-only smart-account foundation for Hercules Wallet.

## Status

- **Network:** public testnets only
- **Production/mainnet:** disabled
- **Canonical account source:** `hercules-hurc/HerculesSmartAccount.sol`
- **Deployment planner:** `hercules-hurc/smart-account-plan.mjs`
- **ERC-4337 EntryPoint:** v0.8 at `0x4337084d9e255ff0702461cf8895ce9e3b5ff108`
- **EntryPoint ownership:** external blockchain infrastructure, not Hercules-owned code
- **Passkey recovery:** not active on-chain; enrollment metadata is staged only

## Account behavior

`HerculesSmartAccount`:

- validates packed ERC-4337 UserOperations;
- accepts only the configured EntryPoint for `validateUserOp`;
- requires low-S secp256k1 owner signatures over the EntryPoint-provided `userOpHash`;
- lets either the owner or EntryPoint execute calls;
- supports bounded batch execution;
- has no upgrade hook, admin role, delegatecall, selfdestruct, or third-party Solidity import;
- exposes EntryPoint deposit and withdrawal controls to the owner.

`HerculesSmartAccountFactory`:

- deploys accounts with CREATE2;
- returns an already deployed account at the same deterministic address;
- derives the CREATE2 salt from owner + user salt.

## Passkey boundary

The Wallet UI can enroll passkey public-key metadata, but that passkey **does not control funds yet**.

Hercules does not activate passkey recovery until all of these are complete:

1. a reviewed on-chain P-256/WebAuthn verification path;
2. dedicated contract tests and differential/fuzz testing;
3. an independent security review;
4. explicit testnet deployment approval;
5. a successful ERC-4337 bundler/UserOperation test on the exact deployed bytecode.

Until then, the smart account uses the local EOA owner signature and the passkey remains a recovery-readiness artifact only.

## Deployment rule

The deployment planner accepts only networks already declared in `hercules-hurc/networks.mjs`:

- Base Sepolia — 84532
- Ethereum Sepolia — 11155111

The planner rejects secret-bearing fields and never signs, broadcasts, or authorizes gas spend.

## Verification

```sh
node scripts/verify-owner-code-only.mjs
node --test tests/hercules-hurc-smart-account.test.mjs
node scripts/hurc-smart-account-solc-input.mjs > /tmp/hurc-smart-account-solc-input.json
/tmp/solc --standard-json < /tmp/hurc-smart-account-solc-input.json > /tmp/hurc-smart-account-solc-output.json
node scripts/hurc-smart-account-check-solc-output.mjs /tmp/hurc-smart-account-solc-output.json
```

The HURC Contract Gate performs the compiler download, pinned SHA-256 verification, compilation, ABI/bytecode checks, and regression tests automatically on pull requests.
