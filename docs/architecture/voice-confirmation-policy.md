# Voice Confirmation Policy Layer

## Purpose

The policy layer is the guardrail that decides whether a conversational outcome is strong enough to change an order.

This layer turns a transcript and a call result into a safe business decision.

---

## Policy principles

A confirmation decision should require all of the following when possible:

- the customer clearly responded
- the response matches the order details
- the order is still valid and still pending
- the call outcome is not a failure or timeout
- the confidence is high enough for an automatic decision

If any of these checks fail, the system should avoid an automatic order change and route the case to a safer state.

---

## Examples of policy rules

### Automatic confirmation

The system may auto-confirm only when:

- the customer clearly says they confirm the order
- the order details match the conversation context
- no contradictions appear in the transcript
- the customer is not asking for a change or delay outside policy

### Automatic rejection or cancellation

The system may reject or cancel only when:

- the customer clearly says they do not want the order
- the decline is explicit and not ambiguous
- the order is still eligible for cancellation under business rules

### Retry

The system should retry when:

- the call failed or timed out
- the customer was not reachable
- the customer asked to be called back later
- no clear answer was received

### Manual review

The system should require review when:

- the customer speaks ambiguously
- the transcript contains conflicting statements
- the customer asks for a different item, quantity, or delivery detail
- the order total or item details do not match the conversation
- the call result is incomplete or low-confidence

---

## Decision output contract

The policy layer should return a structured result such as:

```json
{
  "decision": "confirmed",
  "confidence": 0.94,
  "reason": "Customer explicitly confirmed the order details",
  "requiresManualReview": false,
  "nextAction": "update_order_status"
}
```

Other valid decision values include:

- declined
- retry_later
- no_answer
- ambiguous
- human_review_required
- policy_blocked

---

## Why the policy layer is required

Without a policy layer, a voice agent can over-interpret phrases like:

- "maybe"
- "I think so"
- "is that the total?"
- "okay I guess"

These are not enough to safely change an order state.

The policy layer ensures the system is careful, consistent, and accountable.

---

## Final write path

The policy layer should output a decision, but it should not directly perform the final database mutation.

Instead, it should hand the validated decision to a dedicated order-update service. That final service enforces the actual persistence and audit record.

This creates a clean boundary between:

- what the conversation means
- what the business rules allow
- what the order database should be updated to
