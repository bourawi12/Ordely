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
- ended -> completed (Maria reports a structured decision after her spoken closing)

### Notes

- A call should not move directly from queued to confirmed.
- The business outcome is not the same thing as the communication state.
- The runtime session decides the call-level transition.
- Maria reports customer intent; backend policy validates whether it can change the order.
- An unclear result is retried through three attempts; only an unresolved third attempt requires human review.

---

## Order confirmation states

Persisted order states are:

- pending
- confirmed
- cancelled
- unreachable after the final unsuccessful confirmation attempt

### Typical transitions

- pending -> confirmed after a clear, confident confirmation
- pending -> cancelled after a clear, confident decline
- pending -> pending while unresolved attempts are retried
- pending -> unreachable when the final unresolved call is marked for staff review

### Important rule

Order mutation happens only after backend policy validates Maria's intent at or above 0.7 confidence and confirms the order is still pending.

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

- CONFIRMED
- CANCELLED
- UNCLEAR (retry until attempt three)
- needs_human (only after an unresolved third attempt)
- policy_blocked

These decisions are not the same as call phases. A call can be ended normally while still requiring manual review.

---

## Why this matters

A state machine prevents silent drift between layers. Without it, a call can be marked ended while the order remains pending, or the order can be updated before the transcript is fully evaluated.

The explicit state model keeps the system testable and makes outcomes easier to debug and review.
