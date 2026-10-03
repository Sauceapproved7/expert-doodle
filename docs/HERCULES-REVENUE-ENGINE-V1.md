# Hercules Revenue Engine v1

Hercules Revenue Engine converts approved offers and observed business metrics into a deterministic revenue portfolio without granting itself payment, publication, outreach, or deployment authority.

## Scope

The engine supports the SauceApproved business sequence:

`discover -> build -> package -> publish -> sell -> fulfill -> retain -> measure`

v1 implements the decision layer for the final commercial stages. It accepts explicit offer evidence and observed metrics, scores eligible opportunities, aggregates portfolio metrics, and evaluates whether commerce activation gates are satisfied.

## Differentiators

1. **Evidence-bound opportunity scoring.** An offer receives no opportunity score until offer, price, and fulfillment evidence are explicitly approved. The engine does not infer approvals from revenue, traffic, or customer counts.
2. **Fail-closed commerce activation.** Checkout, refund, payout, paid-order transport, legal approval, and an explicit commerce-enable request must all be verified before the engine reports activation as allowed. The engine still returns `executionAuthority: false`; actual provider mutation remains outside this module.

## Safety and ownership boundary

- No payment-provider mutation.
- No checkout bypass.
- No fabricated revenue or customer metrics.
- No self-granted execution authority.
- No external communications.
- No third-party runtime dependencies; Node.js built-ins only.
- Existing Revenue Recovery remains a separate subsystem and is not replaced.

## Provenance

Project-authored Hercules implementation created for SauceApproved with AI assistance on 2026-10-03. The external `money.md` page supplied business-model inspiration only; no source code, styling, prose, assets, or claimed earnings figures were copied into this implementation.
