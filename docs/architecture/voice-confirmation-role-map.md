# Voice Confirmation Role Map

## Purpose

This document defines ownership boundaries for the voice confirmation flow. Call lifecycle, customer conversation, policy enforcement, and database writes remain separate and auditable.

---

## Layer 1: Call orchestration

### Responsibility

Starts confirmation calls for eligible pending orders.

### Owns

- pending-order selection
- task building and provider handoff
- dispatch state
- retry scheduling and call-window checks

### Does not own

- the live customer conversation
- order outcome interpretation
- order mutation

### Output

A dispatched call task or a rejection reason.

---

## Layer 2: Runtime session

### Responsibility

Owns the live call session while it is active.

### Owns

- session and call lifecycle
- transcript and artifact capture
- end-of-call detection
- errors and timeouts
- forwarding Maria's final structured result

### Does not own

- customer intent
- business policy decisions
- order status changes

### Output

A completed call result, no answer, or technical failure.

---

## Layer 3: Maria

### Responsibility

Handles the customer conversation and decides the customer's intent about the order.

### Owns

- greeting and reading order details
- asking for explicit confirmation
- asking one or two concise, non-repetitive clarification questions when needed
- deciding whether the customer confirmed, declined, or remains unclear
- telling the customer that the order is confirmed or cancelled
- giving a brief goodbye, then reporting intent, confidence, and language

### Does not own

- confidence policy or order eligibility
- database writes
- direct control of the provider connection

### Output

A structured result: CONFIRMED, CANCELLED, or UNCLEAR.

---

## Layer 4: Backend decision policy

### Responsibility

Validates Maria's structured result and determines the permitted next action.

### Owns

- enforcing the configurable confidence threshold (default 0.7)
- checking that the order is still pending
- permitting confirmation or cancellation only for a clear, confident intent
- retrying unresolved outcomes within the existing three-attempt policy
- routing only an unresolved final attempt for human review

### Does not own

- the customer conversation
- speech interpretation by a second AI agent
- telephony lifecycle management

### Output

A validated action: confirm, cancel, retry, review, or policy blocked.

---

## Layer 5: Final order write service

### Responsibility

Applies an allowed decision to the real order record.

### Owns

- order status mutation
- audit logs and review reasons
- persisted order-side effects

### Does not own

- the customer conversation
- realtime telephony state
- the voice script

### Output

A persisted order state change with traceability.

---

## Boundary rule

1. Orchestration selects and starts the call.
2. Runtime owns the call connection and forwards the result.
3. Maria decides customer intent and speaks the outcome before closing.
4. Backend policy validates confidence and eligibility, then handles retry or review.
5. The order write service persists only an allowed change.

No layer should bypass this chain.

---

## Why this matters

This separation keeps conversation logic, telephony lifecycle, and business-safe state changes clear, testable, and auditable.
