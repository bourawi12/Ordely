# Voice Confirmation Role Map

## Purpose

This document defines the ownership boundaries for the voice confirmation flow.

Each layer has a distinct responsibility. The goal is to keep the call lifecycle, the customer conversation, and the business decision separate and auditable.

---

## Layer 1: Call orchestration

### Responsibility

Starts the confirmation call when a pending order needs attention.

### Owns

- pending-order selection
- task building
- provider handoff
- call dispatch state
- retry and scheduling checks

### Does not own

- the live customer conversation
- final business interpretation
- direct order mutation

### Output

A dispatched call task or a rejection reason.

---

## Layer 2: Runtime session

### Responsibility

Owns the live call session while it is active.

### Owns

- session connection
- call state tracking
- transcript capture
- end-of-call detection
- errors and timeouts
- final session result payload

### Does not own

- final order status changes
- business policy decisions
- customer intent validation beyond the session itself

### Output

A structured session result, such as:

- no answer
- ended normally
- failed
- conversation complete
- ambiguous

---

## Layer 3: Maria

### Responsibility

Handles the customer-facing conversation.

### Owns

- greeting
- reading the order details
- asking for confirmation
- clarifying questions
- detecting a clear customer outcome
- signaling when the conversation is complete

### Does not own

- writing the order state
- deciding whether the order is truly confirmed
- deciding business policy outcomes
- directly ending the provider call

### Output

A semantic conversation outcome such as:

- customer_confirmed
- customer_declined
- needs_more_context
- customer_unreachable
- ambiguous

---

## Layer 4: Nora

### Responsibility

Decides the business consequence of the conversation.

### Owns

- comparing the transcript to the real order
- applying policy rules
- checking confidence and clarity
- deciding between confirm, decline, retry, or manual review
- returning a validated next action

### Does not own

- opening the call
- managing the live media session
- speaking to the customer
- directly writing the order row without a backend service

### Output

A validated decision such as:

- confirmed
- cancelled
- retry_later
- manual_review_required
- policy_blocked

---

## Layer 5: Final order write service

### Responsibility

Applies the validated decision to the real order record.

### Owns

- order status mutation
- audit logs
- review queue updates
- any persisted order-side side effects

### Does not own

- the customer conversation
- realtime telephony state
- the voice script itself

### Output

A persisted order state change with traceability.

---

## Boundary rule

The following are the core rules of the design:

1. The orchestration layer starts the call.
2. The runtime layer owns the call session and result.
3. Maria owns the conversation.
4. Nora owns the business decision.
5. The final order service owns the database mutation.

No layer should bypass this chain without a clear reason.

---

## Why this matters

This separation prevents the system from mixing:

- customer conversation logic
- telephony lifecycle logic
- business-safe state changes

It makes the flow explicit, easier to debug, and safer for real operations.
