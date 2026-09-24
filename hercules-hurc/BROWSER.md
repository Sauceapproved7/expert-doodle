# HURC + Hercules Browser

HURC uses the existing Hercules browser gateway for testnet web preparation.

## Boundary

The HURC browser adapter does not replace the wallet signer and does not store a private key, seed phrase, or mnemonic. Its job is to use the owned `hercules-browser` gateway to inspect the official Base funding page and discover the current Base Sepolia faucet path before a deployment is attempted.

Pinned official page:

`https://docs.base.org/get-started/get-funds`

The browser gateway remains responsible for SSRF controls, allowed browser actions, run evidence, and Browserless worker credentials.

## Live edge adapter

The canonical edge source is `hercules-hurc/browser-edge.ts`. It authenticates with the existing Hercules `browser-gateway` service key, retrieves the browser credential server-side, and invokes the already deployed `hercules-browser` function. No browser credential is returned to the caller.

Supported action:

- `discover_faucets`

The result is preparation evidence only. It does not sign or broadcast an EVM transaction.
