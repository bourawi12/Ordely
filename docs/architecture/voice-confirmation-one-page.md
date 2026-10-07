# Voice Confirmation One-Page Architecture Reference

## Overview

Ordely uses a layered voice confirmation flow. The goal is to separate:

- the customer conversation
- the telephony session lifecycle
- the business decision
- the actual database mutation

This keeps the flow safe, auditable, and easy to reason about.

---

## Layer map

### 1. Call orchestration

Starts the call for a pending order.

Responsibilities:

- identify pending order needing confirmation
- validate scheduling and retry limits
- build the call task
- dispatch the task to the runtime/provider
- store dispatch status

Owns:

- task creation and dispatch

Does not own:

- live customer language interaction
- final business outcome
- order mutation

---

### 2. Runtime session

Owns the live call session.

Responsibilities:

- establish the session
- monitor call lifecycle
- collect transcript and artifacts
- detect errors, no-answer, or session closure
- end the call cleanly
- send the result to the decision layer

Owns:

- session lifecycle state

Does not own:

- final order state
- business policy rules
- order decision writing

---

### 3. Maria

The customer-facing conversation agent.

Responsibilities:

- talk to the customer
- confirm the order details
- detect clear yes/no answers
- ask clarifying questions
- signal when the conversation has reached a terminal outcome

Owns:

- customer interaction flow

Does not own:

- direct order mutation
- final decision authority
- live call teardown API calls

Outputs:

- customer_confirmed
- customer_declined
- ambiguous
- no_answer
- needs_more_context

---

### 4. Nora

The business decision agent.

Responsibilities:

- interpret transcript and order data together
- apply policy rules
- decide whether the order should be confirmed, cancelled, retried, or reviewed
- return a validated decision

Owns:

- outcome interpretation and policy compliance

Does not own:

- telephony session lifecycle
- direct customer speech
- direct order write without a backend service

Outputs:

- confirmed
- cancelled
- retry_later
- manual_review_required
- policy_blocked

---

### 5. Final order write service

The final state mutation boundary.

Responsibilities:

- accept a validated decision
- update the order record safely
- add audit trail or notes
- update review queues if needed

Owns:

- real business state change

Does not own:

- customer conversation
- call session state

---

## Core flow

1. Pending order exists.
2. Call orchestration starts a call task.
3. Runtime session creates the live session.
4. Maria talks to the customer.
5. Runtime captures transcript and call outcome.
6. Nora evaluates the transcript and order against policy.
7. Nora returns a valid business decision.
8. Final order write service updates the order.
9. The system triggers the next action: confirm, retry, cancel, or review.

---

## Safety rules

- Do not let Maria directly write the order state.
- Do not let the runtime directly update the order state.
- A call can end without the order being confirmed.
- A customer conversation can be complete without a business decision being applied.
- Order mutation happens only through the final write service.

---

## State model summary

Call states may include:

- queued
- dispatched
- connected
- speaking
- ended
- failed
- no_answer
- needs_human_review

Order states may include:

- pending
- awaiting_confirmation
- confirmed
- cancelled
- retry_scheduled
- manual_review_required

---

## Result

This layered model keeps the system clear:

- the runtime owns the call
- Maria owns the conversation
- Nora owns the decision
- the final service owns the order mutation

This is the correct split for a safe confirmation workflow.
