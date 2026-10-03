# Hercules Native

Owned C boundary for vetted native dependencies.

This scaffold intentionally contains no vendored third-party source. External libraries remain behind reviewed Hercules adapters and are activated only after the C Foundation production gate passes.

Current properties:
- C11;
- bounded input contract;
- explicit status codes;
- warning-clean build policy;
- CTest smoke tests;
- no network, secret, auth, payment, or deployment authority.
