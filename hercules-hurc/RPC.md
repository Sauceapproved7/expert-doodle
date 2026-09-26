# HURC Base Sepolia RPC Probe

This owner-code component performs read-only Base Sepolia network checks before any wallet signer is involved.

Pinned network:

- Network: Base Sepolia
- Chain ID: `84532`
- Hex chain ID: `0x14a34`
- Public RPC: `https://sepolia.base.org`

The probe reads:

- `eth_chainId`
- `eth_blockNumber`
- `eth_gasPrice`

It fails closed if the RPC reports a different chain ID.

The probe does not hold a private key, sign a transaction, or broadcast a transaction.
