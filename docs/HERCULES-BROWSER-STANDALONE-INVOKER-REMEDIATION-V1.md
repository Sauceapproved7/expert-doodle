# Standalone Browser Verifier Invoker Remediation v1

The standalone browser one-time-token verifier now executes with caller privileges instead of SECURITY DEFINER.

## Access model

- The private token table remains outside the exposed Data API schemas.
- anon receives only schema USAGE plus SELECT on the four columns required for token matching/result output and UPDATE only on consumed_at.
- No INSERT, DELETE, or unrestricted table-level SELECT/UPDATE grant is given.
- RLS permits UPDATE only while a token is unconsumed and unexpired and requires the resulting row to have consumed_at set.
- The public verifier hashes the supplied opaque token, atomically consumes only the matching row, and returns only purpose and expiry.
- The service-role-only token issue and autonomous dispatch paths remain unchanged.

This removes anonymous execution of a SECURITY DEFINER function while preserving the one-time token/replay-protection design.
