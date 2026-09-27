# Hercules Privacy Policy — FINAL CANDIDATE v0.2

**Status:** FINAL CANDIDATE — OWNER/QUALIFIED REVIEW REQUIRED BEFORE EFFECTIVE DATE  
**Company:** SauceApproved enterprise LLC  
**Product:** Hercules / Hercules Revenue Recovery  
**Owner/legal review required before publication**

This draft describes the data categories and processing expected for the current Hercules launch architecture. It must be checked against the final production configuration, providers, retention rules, and customer-facing workflow before publication.

## 1. Scope

This policy is intended to cover information processed through Hercules when a business customer:
- creates or uses an account;
- joins a workspace;
- imports, connects, or enters business receivable information;
- uses recovery, workflow, AI-assisted, integration, or automation features;
- contacts support;
- uses a paid plan, if billing is enabled.

It does not govern a third party's independent service or website.

## 2. Information Hercules may process

### Account and identity information
Examples include:
- account identifier;
- email address;
- authentication/session information;
- workspace membership;
- role and authorization evidence.

### Business and workspace information
Examples include:
- business/workspace name;
- plan and entitlement information;
- usage state;
- connected-provider configuration and status.

### Receivable and workflow information
Depending on the customer's use, this may include:
- invoice or receivable identifiers;
- balances, dates, and aging information;
- payment or dispute status supplied by the customer or connected system;
- business contact information;
- case state, reason codes, proposed routes, approvals, and workflow history.

Customers should not provide information that is unnecessary for the supported workflow.

### Communications and generated content
Hercules may process:
- user instructions;
- drafts or messages created through supported features;
- AI-assisted output;
- customer support communications.

### Audit, proof, and security information
Hercules may maintain:
- action and approval history;
- evidence and integrity digests;
- release and verification records;
- authentication and authorization events;
- security events;
- service health and incident records.

### Usage and technical information
Examples include:
- product usage counters;
- feature usage;
- request timestamps;
- service telemetry;
- logs;
- latency and error information;
- device/browser/network information made available by the service infrastructure.

### Billing information
If paid billing is enabled, Hercules may receive billing identifiers, plan status, subscription status, invoices, or payment status from the payment provider.

Payment-card details should be handled by the payment provider rather than stored directly by Hercules unless the production architecture is explicitly changed and reviewed.

## 3. How information is used

Information may be used to:
- provide and operate Hercules;
- authenticate users and enforce workspace permissions;
- process supported receivable and workflow functions;
- generate or assist with requested output;
- apply plan and usage limits;
- verify actions and preserve audit evidence;
- secure the service and investigate abuse or incidents;
- operate backups, recovery, monitoring, and release controls;
- provide customer support;
- process billing when activated;
- comply with legal obligations;
- improve supported product features using methods permitted by applicable law and the final customer agreement.

## 4. AI-assisted processing

Some Hercules features may send selected input to an AI provider or AI-routing layer when the user invokes an AI-assisted capability.

The verified Hercules AI routing path may send the user's prompt, applicable project context, bounded recent conversation context, and an internal system instruction through the SauceApproved G4F routing layer to an allowlisted provider.

The currently verified allowlist includes LLM7, Yqcloud, and KiloCode. Provider selection may use failover, so more than one provider may receive an attempted request when an earlier route fails.

Provider retention and model-training terms remain subject to the provider's current policies and any applicable account settings. Hercules must not publish a stronger "no training" or fixed-retention claim unless provider-specific evidence supports it.

## 5. Service providers and subprocessors

Hercules relies on infrastructure and technology providers to operate the service.

Verified production infrastructure and eligible processing routes currently include:

- **Supabase** — authentication, database, serverless/Edge Functions, workspace and entitlement state, audit/evidence records, monitoring, and launch controls;
- **Render** — hosting for the Hercules Browser gateway/API and related owned browser runtime;
- **Railway** — hosting for the SauceApproved G4F AI-routing service;
- **LLM7, Yqcloud, and KiloCode** — allowlisted AI providers that may receive a bounded request when selected by the Hercules AI routing/failover chain;
- **GitHub** — source control, CI/security/provenance checks, and release/source evidence for Hercules code.

Browserless is used as software/runtime within the SauceApproved-controlled Render browser service rather than as a separately hosted external Browserless account in the verified launch path.

Stripe is **not yet connected** to Hercules. If Stripe is activated for paid launch, this policy must be updated to identify the live payment flow before the `privacy` approval is recorded.

Pending or optional integrations are not evidence that customer data is currently flowing to those providers.

## 6. Sharing

SauceApproved enterprise LLC may disclose information:
- to service providers acting on its behalf;
- at the customer's direction;
- when necessary to provide a requested integration;
- to investigate security or abuse;
- to comply with law or valid legal process;
- in connection with a business transaction, subject to applicable legal requirements.

Hercules does not treat selling customer conversation, receivable, or workspace data to advertisers as part of the launch business model.

## 7. Data retention

Hercules retains information for periods reasonably necessary to:
- provide the service;
- preserve customer-requested history;
- maintain security, audit, proof, release, and recovery evidence;
- meet legal, tax, accounting, or contractual obligations;
- resolve disputes and enforce agreements.

Different categories may have different retention periods.

Before publication, the launch team must verify that any specific retention duration stated publicly is actually enforced by production code, configuration, or documented operational procedure.

## 8. Deletion and export

Subject to applicable law, contractual obligations, security requirements, and technical limitations, customers may request access, export, correction, or deletion of customer data.

Deletion may not immediately remove:
- legally required records;
- security/audit evidence that must be retained;
- backup copies pending normal backup expiration;
- information necessary to establish or defend legal claims.

A monitored business privacy/support request channel must be configured before this candidate becomes effective. Requests must be authenticated or otherwise verified before export, correction, or deletion is performed. Hercules must preserve legally or operationally required audit/security evidence where deletion is not permitted.

## 9. Security

Hercules uses layered controls intended to protect customer information, including access controls, authorization boundaries, monitoring, release controls, integrity evidence, and recovery systems.

No system can guarantee absolute security.

Customers are responsible for protecting their credentials and for promptly reporting suspected unauthorized access.

## 10. International processing

Some service providers may process information in locations different from the customer's location.

Before Hercules is marketed in jurisdictions requiring specific international-transfer mechanisms or disclosures, the required contractual and legal safeguards must be confirmed.

## 11. Children's data

Hercules is a business product and is not intended for children.

The launch service should not knowingly collect children's personal information for its supported business workflows.

## 12. State and regional privacy rights

Depending on where a customer or data subject is located and whether an applicable law covers the processing, rights may include access, correction, deletion, portability, restriction, objection, or appeal.

The final policy must identify the request method and any jurisdiction-specific disclosures required for the actual launch market.

## 13. Changes to this policy

The final policy should explain how material changes are communicated and state the effective date of each version.

## 14. Contact

A monitored privacy/contact channel must be configured before publication. Until that business channel is verified, Hercules must not publish a personal address or personal email as the default privacy contact.

---

## Launch verification blockers in this draft

Before publication:
- inventory the production subprocessors that actually receive customer data;
- verify AI-provider retention/training settings;
- confirm customer-data deletion/export workflow;
- confirm retention practices against production behavior;
- configure a monitored privacy contact;
- confirm state/regional privacy disclosures for the launch market;
- confirm payment-provider data handling if billing is activated;
- ensure public statements match the final Terms of Service and live product.
