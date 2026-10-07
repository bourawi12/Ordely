# Voice Confirmation Decision Flow

## Purpose

This document describes the end-to-end flow from a pending order to an order decision. It shows how the layers interact and where responsibility changes hands.

---

## High-level sequence

1. A pending order exists.
2. The call orchestration layer decides that this order needs a confirmation call.
3. The runtime session layer starts the live call and manages the connection.
4. Maria speaks to the customer and collects the response.
5. The runtime layer records the transcript and final call outcome.
6. Nora evaluates the transcript, order, and policy.
7. Nora produces a validated decision.
8. The final order write service applies the decision to the order.
9. The system records the result and creates the next action if needed.

---

## Decision flow in practice

### Step 1: order enters pending state

The backend has an order that is awaiting confirmation.

### Step 2: dispatch the task

The orchestration layer checks whether the order is eligible for calling.

It verifies:

- the order is still pending
- the customer phone is available
- retry limits are not exceeded
- the call window is valid
- the order is not already being processed

### Step 3: runtime opens the live session

The runtime session layer opens the call and monitors the session lifecycle.

It is responsible for:

- provider connection
- transcript collection
- failure detection
- end-of-call handling

### Step 4: Maria speaks to the customer

Maria uses the order details and customer context to ask for confirmation.

She may:

- confirm the item
- confirm quantity and amount
- ask whether the customer wants a different delivery time
- detect a clear yes or no
- recognize ambiguity

### Step 5: conversation reaches a terminal state

Maria decides the customer interaction has reached a final outcome, such as:

- confirmed
- declined
- no answer
- ambiguous
- needs human review

This outcome is communicated in a structured form, not as a direct database update.

### Step 6: runtime sends the result

The runtime sends the final transcript and the call disposition to the decision layer.

It reports the conversation result without changing the order itself.

### Step 7: Nora evaluates the outcome

Nora checks the stated outcome against the actual order and policy.

She looks at:

- whether the customer explicitly confirmed or declined
- whether the transcript and order match
- whether the confidence is high enough
- whether business rules allow an automatic change

### Step 8: Nora returns the validated decision

Nora returns a single outcome such as:

- confirmed
- cancelled
- retry_later
- human_review_required
- policy_blocked

### Step 9: write the final order state

The final order write service persists the allowed decision.

This service does the actual state update and records the audit trail.

### Step 10: next action is triggered

Depending on the decision, the system may:

- mark the order as confirmed
- schedule a retry call
- cancel the order
- flag the order for staff review
- keep the order pending with a reason

---

## Key separation of responsibility

- Call orchestration starts the call and decides whether a call should happen.
- Runtime session owns the live call and end-of-call lifecycle.
- Maria handles the conversation and customer-facing flow.
- Nora interprets the outcome and decides the business result.
- Final order write service performs the actual database mutation.

---

## Safety rule

No layer except the final order write service should directly change the order state.

This rule prevents accidental order mutation from a vague phrase, a partial transcript, a failed session, or an incomplete call.

---

## Example flow

A simple successful path is:

- order is pending
- call is dispatched
- runtime starts the session
- Maria asks for confirmation
- customer says "yes, I confirm the order"
- runtime records the transcript
- Nora validates the transcript against the order
- Nora returns `confirmed`
- final write service marks the order as `confirmed`

A failure path is:

- order is pending
- call is dispatched
- customer does not answer
- runtime marks `no_answer`
- Nora decides `retry_later`
- final write service keeps the order pending and schedules another attempt

A review path is:

- call ends
- customer says something unclear or contradictory
- Nora returns `human_review_required`
- final write service leaves the order pending and exposes it to a human queue

---

## Summary

The decision flow exists to convert a finished conversation into a safe business action. The conversation agent speaks, the runtime owns the call, the decision layer interprets the meaning, and the final order service writes the result.
