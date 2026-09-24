# HURC Testnet Signer Core

This module is an original, dependency-free testnet signer implementation for HURC.

It implements only the cryptographic primitives needed for the Base Sepolia HURC deployment path:

- Keccak-256
- RLP encoding
- secp256k1 public-key derivation
- RFC6979-style deterministic ECDSA nonce generation using HMAC-SHA-256
- low-s ECDSA signatures
- EIP-1559 typed transaction signing

## Hard boundary

The signer refuses every chain ID except Base Sepolia `84532`.

It is **not approved for mainnet**. Mainnet usage requires a separate security review and explicit production authorization.

No private key, seed phrase, or mnemonic is committed to the repository. Test private keys used in tests are public deterministic vectors only and carry no funds.

## Owner-code rule

The implementation imports no ethers, web3, wallet SDK, secp256k1 package, Keccak package, or transaction library. Runtime cryptographic randomness and HMAC use the platform Web Crypto API as infrastructure.
