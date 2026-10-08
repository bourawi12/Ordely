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
- forward Maria's structured result to the backend callback

Owns:

- session lifecycle state

Does not own:

- final order state
- business policy rules
- order decision writing

---


### 3. Maria

The customer-facing conversation agent and source of the structured customer-intent result.

Responsibilities:

- talk to the customer and read the order details
- ask one or two concise, non-repetitive clarifying questions when needed
- decide whether the customer confirmed, declined, or remains unclear
- tell the customer the order is confirmed or cancelled before saying goodbye
- report intent, confidence, and language after her spoken closing

Owns:

- the customer interaction and intent decision

Does not own:

- confidence policy or order eligibility
- direct order mutation
- provider connection teardown

Outputs:

- CONFIRMED
- CANCELLED
- UNCLEAR

---

### 4. Backend decision policy

Validates Maria's result and determines the permitted next action.

Responsibilities:

- enforce the configurable 0.7 confidence threshold
- confirm or cancel only while the order is still pending
- retry unresolved calls under the existing three-attempt schedule
- route only an unresolved third attempt to human review

Owns:

- order eligibility, policy enforcement, and retry/review routing

Does not own:

- live customer speech
- telephony session lifecycle

Outputs:

- confirmed or cancelled order update
- retry_later
- `needs_human` after the final unresolved attempt
- policy_blocked

---

### 5. Final order write service

Persists allowed decisions.

Responsibilities:

- update the order record safely
- record the result and review reason

Owns:

- real business state change

Does not own:

- customer conversation
- call session state

## Core flow

1. Orchestration dispatches an eligible pending order to Maria.
2. Maria asks for confirmation and may ask one or two concise clarifying questions.
3. Maria tells the customer whether the order is confirmed or cancelled, says goodbye, then reports intent, confidence, and language.
4. The runtime waits for her final audio to drain, ends the call, and sends the result to Ordely.
5. Backend policy checks confidence (at least 0.7) and that the order remains pending before updating it.
6. Unclear results retry after 30 minutes and then two hours; an unresolved third attempt is marked `needs_human` and the order becomes `unreachable` until an operator explicitly retries it.

---

## State model summary

Persisted call statuses are pending, confirmed, failed, and no_answer. A `needs_human` disposition is a final review marker after attempt three; an `ambiguous` disposition remains retryable before then.

Persisted order statuses are pending, confirmed, and cancelled. Retries and final review leave the order pending.

---

## Result

This layered model keeps the system clear:

- the runtime owns the call
- Maria owns the conversation
- Maria owns customer intent; backend policy owns eligibility and retry/review decisions.
- the final service owns the order mutation

This is the correct split for a safe confirmation workflow.
