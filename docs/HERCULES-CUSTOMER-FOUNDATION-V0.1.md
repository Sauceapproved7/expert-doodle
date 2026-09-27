# Hercules Customer Foundation v0.1

The customer foundation creates a cross-Hercules customer boundary above the existing Forge identity/workspace system and Chat usage/billing data.

It binds:
- authenticated user identity evidence
- workspace identity
- workspace membership role evidence
- plan identifier and entitled Hercules features
- monthly action limit
- current monthly action usage
- deterministic integrity digest

## Action evaluation

The initial role ladder is:
- viewer -> read
- builder -> build
- admin -> publish
- owner -> billing.manage

A request fails closed for:
- invalid customer context integrity
- workspace mismatch
- missing plan feature
- insufficient workspace role
- exhausted monthly action allowance
- unknown action

A satisfied customer boundary still has executionAuthority=false. It must continue through the Hercules command, unified execution, authorization, and provider boundaries.

## Existing systems reused

This layer does not replace Forge sessions/workspaces, Supabase Auth/RLS, Hercules Chat usage accounting, or provider billing. It supplies the shared customer context those owned systems can bind into the wider Hercules runtime.

Payment processing remains an external adapter. Hercules plan/entitlement decisions remain owned control logic.
