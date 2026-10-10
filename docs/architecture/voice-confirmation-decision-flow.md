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
6. Maria reports structured intent, confidence, and language after telling the customer the outcome and saying goodbye.
7. Backend policy checks confidence and verifies that the order is still pending.
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
- ask one or two concise clarifying questions when needed, without repeating herself
- detect a clear yes or no
- recognize ambiguity

### Step 5: conversation reaches a terminal state

Maria decides the customer interaction has reached a final outcome, tells the customer whether the order is confirmed or cancelled, and says goodbye. She then reports one of:

- confirmed
- declined
- no answer
- ambiguous
- unclear after up to two clarifying questions

This outcome is communicated in a structured form, not as a direct database update.

### Step 6: runtime sends the result

The runtime waits for Maria's final spoken audio to drain, ends the provider call, and sends the transcript and structured result to the backend callback.

It reports the conversation result without changing the order itself.

### Step 7: Backend validates the outcome

Backend policy checks Maria's stated outcome against the 0.7 confidence threshold and actual order state.

Backend policy checks:

- whether Maria reported an explicit confirmation or cancellation
- whether confidence is at least 0.7
- whether the order remains pending

### Step 8: Backend derives the next action

Backend policy derives a next action such as:

- confirmed
- cancelled
- retry_later
- human_review_required only after the third unresolved attempt
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
- Maria decides customer intent; backend policy validates eligibility and determines retries or final review.
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
- Maria says the order is confirmed, says goodbye, and reports `CONFIRMED`
- backend policy validates confidence and the pending order state
- final write service marks the order as `confirmed`

A failure path is:

- order is pending
- call is dispatched
- Maria remains uncertain after two clarifying questions
- Maria tells the customer Ordely will follow up and reports `UNCLEAR`
- backend keeps the order pending and schedules another attempt

A review path is:

- call ends
- customer says something unclear or contradictory
- Maria remains unclear through attempt three; backend marks the final call for review and moves the order to `unreachable`
- the call log shows `needs_human` and the reason for staff follow-up

---

## Summary

The decision flow converts Maria's structured report into a safe business action. Maria speaks and decides intent, the runtime owns telephony, and backend policy validates and persists the result; unresolved outcomes are retried before human review.
