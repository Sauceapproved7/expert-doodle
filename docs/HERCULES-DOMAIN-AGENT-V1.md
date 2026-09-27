# Hercules Domain Agent V1

**Status:** implementation candidate  
**Canonical repository:** `Sauceapproved7/expert-doodle`  
**Primary owned identity:** `https://agent.sauceapproved.com`

## Purpose

Hercules Domain Agent turns an owned SauceApproved domain into a persistent AI-agent control identity.

The domain is not treated as a password, universal credential, or authorization bypass. It is the stable public identity and control surface through which Hercules can:

- receive automation tasks;
- route work through the owned Hercules agent router;
- locate an already-authorized provider connection;
- refresh an eligible provider grant automatically;
- evaluate task scope against a cryptographically fingerprinted authority lease;
- stop exactly at owner-only boundaries;
- execute through a credential-isolated provider adapter;
- return an auditable decision and execution result;
- deduplicate retries through idempotency.

## Product architecture

```
client / Hercules
       |
       v
agent.sauceapproved.com
       |
       +-- public discovery + health
       |
       +-- authenticated task ingress
               |
               v
       tenant + replay gate
               |
               v
       provider grant resolver
               |
        +------+------+
        |             |
      active        expired
        |             |
        |       automatic refresh
        |             |
        +------+------+
               |
               v
       Hercules authority lease
               |
               v
       owner-boundary policy
               |
               v
       Hercules embedded AI router
               |
               v
       credential-isolated provider adapter
               |
               v
       evidence / result
```

## Identity contract

A Hercules Domain Agent identity binds:

- public HTTPS origin;
- tenant identifier;
- stable agent identifier;
- public subject URI;
- discovery URL.

Identity metadata does **not** itself grant execution authority.

The V1 discovery document is published at:

```
https://agent.sauceapproved.com/.well-known/hercules-agent.json
```

It advertises capabilities and security properties without exposing provider connection references or credentials.

## Authorization model

Hercules separates three different concepts:

1. **Domain identity** — who the agent is.
2. **Provider grant record** — evidence that a provider connection was legitimately authorized, represented only by a connection reference, approved scopes, authorization-evidence hash, status, and expiry metadata.
3. **Authority lease** — the specific task intent, resource, action, impact ceiling, evidence binding, and validity window.

A task becomes execution-eligible only when all three align.

The task request ID must match the authority lease intent. The lease subject must match the domain agent. The provider-grant authorization evidence must match the lease authorization evidence. Tenant, provider, resource, action, impact, time window, and required scopes are checked independently.

## Owner-only boundaries

The agent must stop for actions that genuinely require the owner, including:

- payments;
- private credentials or 2FA;
- identity verification;
- legally binding consent;
- new provider permission grants;
- irreversible high-impact owner decisions;
- physical-world actions;
- information only the owner possesses.

The system may complete all safe work around such a boundary, but it must not manufacture consent, impersonate the owner, defeat human verification, or evade provider controls.

## Credential isolation

Provider credentials are never accepted into a Hercules provider-grant record.

The domain-agent service passes adapters only:

- provider identifier;
- opaque connection reference;
- tenant;
- task details;
- Hercules route result;
- authority-decision fingerprint.

Actual provider credential custody remains inside the authorized connector/adapter boundary.

## Replay and retry safety

Every mutating task request requires an idempotency key.

The service fingerprints the full task body and records the result by tenant + idempotency key.

- same key + same task => recorded result;
- same key + different task => conflict;
- no second provider action is performed for a successful replay.

Production persistence should use a durable tenant-scoped store rather than the default in-memory store.

## AI routing

Domain-agent task routing uses the owned Hercules embedded agent router through `domain-agent-router.mjs`.

The authorization decision happens **before** routing or provider execution. AI routing cannot elevate scope, create permission, or change an owner-only decision.

## Commercialization boundary

Hercules Domain Agent can be packaged as a multi-tenant product while preserving the same controls.

A commercial deployment can provide:

- customer-owned domain or SauceApproved subdomain identity;
- provider connection catalog;
- policy templates;
- automated token refresh;
- workflow execution;
- audit/evidence history;
- usage metering;
- plan limits;
- team roles and approval policies;
- API access;
- white-label deployment.

Tenant isolation remains mandatory. A provider grant, idempotency result, authority lease, or execution adapter reference from one tenant must never authorize another tenant.

## Security non-claims

V1 does not claim:

- the domain itself replaces provider authorization;
- the agent can bypass OAuth, 2FA, CAPTCHA, identity checks, signatures, or payment controls;
- a stored grant record contains provider credentials;
- the current in-memory idempotency store is sufficient for horizontally scaled production;
- DNS configuration or public deployment is complete merely because repository code exists.

## Deployment target

The intended public topology is:

- `agent.sauceapproved.com` — public agent identity and task ingress;
- internal Hercules model routing — owned AI route decision;
- external provider adapters — credential custody and provider execution;
- durable tenant-scoped state — grants, idempotency, evidence, and audit history.

Public DNS, TLS, production hosting, and provider callback configuration must be independently verified before the domain agent is represented as live.
