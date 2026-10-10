# Voice Confirmation Architecture

## Purpose

Ordely needs a clean separation between the live customer conversation, the call lifecycle, and the business decision that changes an order.

The system should behave like this:

- the customer-facing voice flow asks the customer to confirm the order
- the session runtime keeps the live call alive and tracks transcript and status
- Maria reports the customer's decision in a structured result
- backend policy validates the result and controls retries
- a final backend service writes the final order state only when the decision is valid

The architecture is intentionally layered so that the customer conversation, telephony lifecycle, and business mutation do not become the same responsibility.

---

## Core layers

### 1. Maria: customer conversation agent

Maria is the voice-facing component. Her role is to talk to the customer, ask for confirmation, handle ambiguity, and signal when the conversation has reached a terminal outcome.

Maria should:

- greet the customer
- read the order details
- ask for explicit confirmation
- ask one or two concise, non-repetitive clarifying questions when needed
- decide whether the customer clearly confirmed, declined, stalled, or became unreachable
- tell the customer whether the order is confirmed or cancelled
- give a brief goodbye before reporting the structured outcome
- confirm the address
- emit a structured outcome for the rest of the system

Maria should not be responsible for mutating the order state.

### 2. Call orchestration layer

The orchestration layer decides whether a call should be launched for a given pending order. It selects the correct provider, prepares the task payload, and starts the task.

This layer is responsible for:

- finding pending orders that need confirmation
- validating call eligibility
- preparing the order data for the call
- starting the call task
- tracking task or provider state

This layer is not the same as the live call manager. It is the scheduler and starter.

### 3. Runtime session layer

The runtime session layer owns the live call lifecycle. It manages the session, receives transcript and status events, and decides when the call should end or fail.

This layer is responsible for:

- opening the session
- monitoring provider and session events
- collecting transcript and artifacts
- detecting a finished or failed call
- closing the call cleanly
- forwarding Maria's structured result to the backend callback

This layer should not directly modify the order status. It reports the outcome of the call.

### 4. Backend decision policy

The backend consumes Maria's structured intent, confidence, and language. It requires confidence of at least 0.7 and a still-pending order before confirming or cancelling. Unclear or below-threshold results are retried under the existing three-attempt schedule; only a still-unresolved third attempt is routed for human review.

### 5. Final order write service

The final write service is the backend boundary that applies a valid order decision to the database.

It should:

- accept the validated decision from backend policy
- verify the order still matches the expected state
- update the order status
- write an audit log or notes
- maintain traceability for the call and result

This service prevents business changes from happening in the conversation layer or runtime layer.

---

## Relationship between the layers

The system should be organized in a clear sequence:

1. A pending order exists.
2. The call orchestration layer decides to launch a confirmation call.
3. The runtime session layer creates and runs the live call.
4. Maria speaks to the customer and collects a conversational outcome.
5. The runtime session layer forwards the transcript and Maria's structured result to the backend callback.
6. Backend policy checks Maria's result against the confidence threshold and current order state.
7. The final order write service mutates the order only when the decision is valid.

This keeps the application safe and understandable.

---

## Why the separation matters

If the conversation agent is also allowed to mutate the order, then the system becomes fragile. The voice agent can misread intent, over-trust a partial answer, or act before the full call result is known.

The same applies if the runtime layer directly changes the order. Telephony state and business state are different concerns.

The separation ensures:

- telephony failures stay in the runtime layer
- Maria reports customer intent; backend policy validates which action is allowed
- actual order mutations happen only through a controlled backend service

---

## Required outcome of the final design

The final implementation should support:

- a clear distinction between conversation outcome and order outcome
- deterministic call states
- policy-based decision rules
- auditable, reviewable order changes
- safe handling of ambiguity, retries, and manual review

This produces a reliable confirmation flow without granting too much authority to any single layer.
