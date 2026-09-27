# Hercules Customer Journey

## Launch flow

### 1. Account
Customer authenticates and enters an authorized workspace.

### 2. Workspace
The workspace shows the business name, member role, plan/entitlements, usage state, and recent verified activity.

### 3. Connect or import receivables
Launch v1 accepts only supported data paths. Imported records must preserve source identifiers and must never invent invoice/payment/dispute facts.

### 4. Recovery desk
Each receivable is represented by one Hercules Revenue Recovery product case:
- invoice state;
- balance and age;
- priority;
- safe-to-contact state;
- evidence/reason codes;
- proposed route;
- approval requirement.

### 5. Review
Paid, disputed, do-not-contact, active-promise, unverified-history, and manual-review cases are visibly separated from contact-ready cases.

### 6. Approval
A customer action must pass workspace/role/plan/usage checks, command normalization, unified execution evidence, authority scope, and consequence/recovery boundaries before any external adapter is eligible to act.

### 7. Result
The customer sees what happened, what evidence verified it, current status, and recovery/compensation information when relevant.

## Required UX states

Every consequential operation needs visible:
- proposed;
- requires approval;
- running;
- verified;
- human review;
- failed;
- recovery available;
- compensated/manual recovery;
- complete.

Never use a success state before post-action verification exists.

## Launch-quality rule

The first public workflow should be narrower and finished rather than broad and ambiguous. Unsupported connectors/actions should be unavailable or explicitly labeled, never simulated.
