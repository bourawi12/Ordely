---
validated: yes
---
# Plan — Story s02-custom-website-status-callback

## Goal

As an ecommerce merchant, I enter my website's callback URL in the Custom Website API settings. When Ordely confirms or cancels one of my imported orders, Ordely POSTs the new status and my external order ID to that URL.

## Existing foundation

- Each boutique has one `Integration` record with a `webhookUrl` and `webhookSecret`.
- `PATCH /api/integrations/custom-api` already saves `webhookUrl`.
- `IntegrationWebhookService` already sends a signed HTTP POST when called.
- Orders retain their originating `externalOrderId` and `boutiqueId`.
- Voice calls and status decisions stay entirely server-side. The ecommerce website does not start or dispatch calls.

## Modularity boundary

- Order and voice status handlers depend on a small `OrderStatusUpdatePublisher` interface, not on `IntegrationWebhookService`, HTTP, or a specific store platform.
- The Custom Website API is the first implementation/adapter of that interface. It resolves the boutique's configured URL and translates the provider-neutral update into the existing signed HTTP payload.
- Keep the interface payload limited to boutique ID, Ordely order ID, external order ID, and the new status. Do not pass Prisma models, request objects, or voice-provider details across it.
- Wire the interface implementation at the Nest composition boundary. Future integration methods can add implementations/adapters without adding provider-specific branches to order or voice status logic.
- Keep this first delivery single-destination and simple. Do not build a general plugin registry, event bus, or retry framework for hypothetical connectors.

## Scope

Implement only:

1. A callback URL field and Save action in the Custom Website API details dialog.
2. A simple status callback to the saved URL when an externally imported order changes to `confirmed` or `cancelled`.
3. A narrow provider-neutral status-update interface with the Custom Website API as its first adapter.
4. A documented request body, preserving the existing signature header behavior.
5. Focused tests proving interface invocation, adapter URL selection, correct client/order association, status payload, and no callback for unrelated orders/statuses.

Do not add an outbox table, background delivery worker, retry policy, delivery-history UI, secret rotation flow, extra event types, or call-launch endpoint in this story. A failed HTTP request is logged; delivery retry behavior can be considered separately only if needed.

## Callback contract

Ordely sends `POST` to the merchant-provided URL:

```json
{
	"event": "order.confirmed",
	"order": {
		"externalOrderId": "shop-order-1001",
		"ordelyOrderId": 42,
		"status": "confirmed"
	}
}
```

Cancellation uses `order.cancelled` and `status: "cancelled"`. Requests include `Content-Type: application/json`, `X-Ordely-Event`, and retain the existing `X-Ordely-Signature` header. Secret display, rotation, and receiver-side signature setup are outside this scope.

## Ordered implementation tasks

### 1. Configure callback URL

- Add a URL input and Save action in the Custom Website API details dialog.
- Load the current URL from the existing integration response; add it to the response shape without exposing `webhookSecret`.
- Save through the existing authenticated `PATCH /api/integrations/custom-api` endpoint.
- Show a clear saved state and basic URL validation.

### 2. Send status changes

- Add the provider-neutral `OrderStatusUpdatePublisher` contract and injection token in the integration/application boundary.
- Invoke the contract after a persisted order transition to `confirmed` or `cancelled`; callers do not know which integration method sends the update.
- Adapt `IntegrationWebhookService` into the Custom Website API implementation. It sends only when the boutique has a configured URL and the order has an `externalOrderId`.
- Keep HTTP, signing, and payload mapping inside this adapter. Keep delivery non-blocking; log a failed request and do not introduce retry infrastructure in this scope.
- Preserve the current voice and manual status paths while removing direct calls to the concrete webhook service from those paths.

### 3. Verify

- Test that each boutique's URL receives only its own external order updates.
- Test publisher invocation for confirmed/cancelled transitions and no invocation for other statuses.
- Test the Custom Website API adapter's payload/signature and correct per-boutique URL selection independently of order/voice services.
- Test that pending, unreachable, manual orders without an external ID, and unchanged statuses do not trigger a callback.
- Run focused backend tests, backend build, frontend build, and `git diff --check`.

## Definition of done

- Merchant can enter and save their website callback URL from the Custom Website API details dialog.
- Confirming or cancelling an imported website order causes Ordely to POST its new status and external order ID to that URL.
- Order and voice status handling depend only on the publisher interface; Custom Website HTTP behavior is isolated in its adapter.
- The callback contains the ecommerce order ID and its new confirmed/cancelled status.
- No extra public call-launch action or complex delivery subsystem is added.
