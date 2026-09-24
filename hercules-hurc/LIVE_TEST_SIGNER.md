# HURC Live Test Signer

This service prepares one server-side Base Sepolia signer for HURC test deployment.

## Key custody

- The private key is generated inside the Edge runtime.
- The private key is written directly to Supabase Vault through `hercules_store_secret`.
- The signer metadata table stores only the public address and Vault reference.
- The raw private key is never returned by the service.
- The in-memory byte array is overwritten after Vault storage.

## Network boundary

The service is Base Sepolia only (chain ID `84532`).

This service does not authorize mainnet and does not by itself broadcast a blockchain transaction.
