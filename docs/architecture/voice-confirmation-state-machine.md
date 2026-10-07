# Voice Confirmation State Machine

## Purpose

The call-confirmation flow should be described as a state machine so that every transition is explicit, testable, and auditable.

This document defines the call and order states that the system should track.

---

## Call lifecycle states

The call can move through a lifecycle like this:

- queued
- dispatched
- ringing
- connected
- speaking
- ended
- failed
- no_answer
- needs_human_review
- completed

### Typical transitions

- queued -> dispatched
- dispatched -> ringing
- ringing -> connected
- connected -> speaking
- speaking -> ended
- speaking -> failed
- speaking -> no_answer
- speaking -> needs_human_review
- ended -> completed

### Notes

- A call should not move directly from queued to confirmed.
- The business outcome is not the same thing as the communication state.
- The runtime session decides the call-level transition.
- The decision layer decides the business-level outcome.

---

## Order confirmation states

The order should also be represented explicitly:

- pending
- awaiting_confirmation
- confirmed
- cancelled
- retry_scheduled
- manual_review_required

### Typical transitions

- pending -> awaiting_confirmation
- awaiting_confirmation -> confirmed
- awaiting_confirmation -> cancelled
- awaiting_confirmation -> retry_scheduled
- awaiting_confirmation -> manual_review_required

### Important rule

Order mutation should happen only after the decision layer has processed the call result and validated that the outcome meets policy.

---

## Event model

The system should emit structured events such as:

- call.started
- call.dispatched
- call.connected
- call.transcript
- call.ended
- call.failed
- call.no_answer
- order.decision
- order.updated
- order.review_required

Each event should carry:

- callId
- orderId
- boutiqueId
- timestamp
- status or disposition
- reason or notes
- confidence, where relevant

---

## Terminal decisions

The final decisions should be explicit and not left to guesswork.

Examples:

- customer_confirmed
- customer_declined
- customer_unreachable
- ambiguous_response
- requires_manual_review
- policy_blocked

These decisions are not the same as call phases. A call can be ended normally while still requiring manual review.

---

## Why this matters

A state machine prevents silent drift between layers. Without it, a call can be marked ended while the order remains pending, or the order can be updated before the transcript is fully evaluated.

The explicit state model keeps the system testable and makes outcomes easier to debug and review.
