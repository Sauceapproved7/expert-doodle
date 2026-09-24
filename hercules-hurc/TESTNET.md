# HURC testnet deployment gate

This layer prepares HURC for a test deployment without committing wallet secrets or authorizing mainnet.

The deployment intent must name the canonical HURC source, identify a testnet chain ID, provide a non-zero treasury address, and specify a positive whole-token supply. The validator rejects mainnet intents and rejects common secret fields such as private keys, seed phrases, and mnemonics.

The template intentionally contains invalid placeholder values. It cannot pass validation until an authorized testnet network, treasury address, and test supply are selected.

A blockchain transaction still requires an external wallet signer and testnet gas. Those are infrastructure/authorization boundaries and are not stored in the repository.
