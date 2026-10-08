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
- Maria reports a clear intent with confidence of at least 0.7

If any check fails, do not change the order. Retry unclear or below-threshold results automatically; human review is reserved for an unresolved third attempt.

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

Human review is reserved for an unresolved third attempt. On each call, Maria may ask one or two concise clarifying questions. If intent is still unclear or confidence is below 0.7, schedule the next allowed attempt. After attempt three, mark the call for staff review and move the order to `unreachable`; a shop operator may explicitly reopen it for another call.

---

## Decision output contract

The policy layer should return a structured result such as:

```json
{
  "disposition": "completed",
  "intent": "CONFIRMED",
  "confidence": 0.94,
  "language": "TUNISIAN_ARABIC"
}
```

Backend-derived outcomes include:
- confirmed
- cancelled
- ambiguous (retryable before attempt three)
- needs_human (after an unresolved third attempt)
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
