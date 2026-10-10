---
validated: yes
---
# Plan — Story s03-call-orchestration-layer

## Target story

As a boutique operator, I want Ordely to orchestrate confirmation calls for pending orders so Maria makes no more than three attempts per order, respects the boutique's calling hours, and spaces retries safely.

## Current implementation and constraints

- `Call` already represents one attempt and has an `attempt` number, `dispatchedAt`, `completedAt`, and structured `disposition`.
- `CallsService.queue()` and `queueAllPending()` currently create attempts from call counts without enforcing a maximum or retry delay.
- `CallDispatcherService.dispatchCall()` checks pending state and in-process concurrency, but does not check boutique calling hours.
- `Boutique.callStartTime` and `callEndTime` are `HH:MM` values documented as `Africa/Tunis`; onboarding requires a same-day window of at least one hour.
- The runtime currently reports `no_answer`, `error`, or `needs_human` for these end states. The policy docs say unreachable/failed calls may retry; declined, ambiguous, and human-review outcomes must not be retried automatically.
- No external queue/broker is needed for this single-worker phase. Keep concurrency at one.

## Policy decisions

- Enforce a hard maximum of three `Call` attempt records per order. Existing attempt rows count toward the cap.
- Measure each minimum delay from the previous attempt's `completedAt` to the next dispatch: 30 minutes after attempt 1, and 2 hours after attempt 2. A retry is not eligible until the prior attempt has a terminal result and completion timestamp.
- Retry only `no_answer` and `error` automatically. Keep `needs_human`, decline, and confirmation terminal for automation. Add a callback-later disposition only if the voice contract is extended to represent it explicitly.
- Interpret boutique hours in `Africa/Tunis`, consistent with the schema. Treat the window as start-inclusive/end-exclusive. If an attempt becomes due before today's opening, hold it until today's opening; if it becomes due at or after closing, defer it to the next calendar day at `callStartTime`. Do not dial after closing. Overnight windows remain unsupported, consistent with onboarding validation.
- Apply the time-window guard both in orchestration and immediately before `startTask()` so direct dispatch requests cannot bypass it.
- Before dispatch, call Ringio's
 `GET /api/capacity` and proceed only when `canLaunchCall` is `true` (at least one idle mobile app and no Ringio-queued calls). A missing/malformed response or unreachable capacity API fails closed.
- If capacity disappears after an attempt row is prepared, keep that same row `pending` and reuse its attempt number on the next poll; do not create a retry or mark a provider failure until a task was actually launched.
- Keep Ringio's `availabilityPolicy` as `reject`. Do not use its FIFO `queue` policy, because a mobile app could become available after the boutique's calling window closes.
- Automatically discover and launch the complete call sequence: attempt 1 for each eligible pending order, then eligible retries 2 and 3 after their required delay. No attempt may depend on an operator queueing or dispatching it. Existing endpoints may remain for compatibility, but must not bypass the same cap, timing, and window rules.
- Derive retry due times from the preceding call's `completedAt`; do not add a separate scheduler timestamp column.

## File-by-file implementation map

- `backend/src/voice/voice-agent-client.interface.ts`: add a provider-neutral capacity/readiness result that distinguishes unavailable capacity from an accepted task.
- `backend/src/voice/adapters/ringio.adapter.ts`: keep the selected healthy local/fallback server URL; call its `GET /api/capacity` with a short timeout and validate `canLaunchCall`. Re-check on that same selected server immediately before forking the worker.
- `backend/src/voice/adapters/fake-voice-agent-client.ts`: expose controllable ready/unavailable results for orchestration tests.
- `backend/src/voice/call-orchestrator.service.ts` (new): run a non-overlapping Nest lifecycle poll, discover first attempts and retry candidates, calculate local-time eligibility, retain pending work while capacity is unavailable, and dispatch eligible calls.
- `backend/src/voice/call-dispatcher.service.ts`: preserve provider/task construction and concurrency guard; enforce the final boutique-window and capacity checks, and leave a not-launched attempt pending rather than marking it rejected.
- `backend/src/voice/voice.module.ts`: register and export the orchestrator; keep the provider adapter behind `VOICE_AGENT_CLIENT`.
- `backend/src/calls/calls.service.ts`: make existing queue endpoints use the same eligibility rules; they remain compatibility/manual triggers, not prerequisites for automatic calling.
- `backend/prisma/schema.prisma` plus a new migration: add unique `(orderId, attempt)` protection after checking existing data for duplicates. Do not add a separate scheduler timestamp; derive due time from `completedAt`.
- `backend/src/voice/call-orchestrator.service.spec.ts` (new), `backend/src/voice/call-dispatcher.service.spec.ts`, `backend/src/voice/adapters/ringio.adapter.spec.ts`, and `backend/src/calls/calls.service.spec.ts`: cover poll/retry logic, guard behavior, capacity responses, and duplicate prevention.

## Ordered implementation tasks

### Task 1: Shared attempt eligibility policy
- Add a small voice orchestration service/helper for retry eligibility, attempt limits, and boutique-window evaluation.
- Use `DEFAULT_TIMEZONE` (`Africa/Tunis`) and the existing `callStartTime`/`callEndTime`; avoid a new boutique timezone field for the current Tunisia-only setup.
- Add a database uniqueness constraint on `(orderId, attempt)` so concurrent queue triggers cannot create the same attempt twice; inspect existing rows before applying the migration.
- Calculate the next allowed dispatch time in boutique-local time: today's opening if not yet open, otherwise tomorrow's opening after the window has closed.

### Task 2: Queue and retry lifecycle
- Route `queue()` and `queueAllPending()` through the shared policy so neither path can create attempt 4 or skip the retry delay.
- Have the orchestrator automatically discover pending orders with no call history for attempt 1, then automatically discover and dispatch retryable completed calls for attempts 2 and 3 when their delay has elapsed.
- Create the next attempt only when eligible; if Ringio has no capacity, leave it eligible without consuming an attempt number. If outside boutique hours after closing, schedule it for the next day's opening.
- Reuse an already-created `pending` call row if the capacity check fails or capacity disappears before worker launch; only create the next attempt after the previous one completed and its retry delay elapsed.
- Re-check that the order is still pending and has no active call before creating or dispatching an attempt.

### Task 3: Scheduled dispatch and final guard
- Add a lightweight Nest lifecycle timer to poll for eligible work; use the existing single-process/single-active-call model and no broker dependency.
- Add a provider-neutral readiness check to `VoiceAgentClient`; implement it in `RingioAdapter` using `GET /api/capacity` on the selected healthy Ringio server.
- Dispatch eligible queued attempts through `CallDispatcherService`.
- Enforce both capacity and the boutique window immediately before calling the provider. Distinguish capacity-unavailable from provider failure; capacity-unavailable leaves the pending attempt reusable and does not contact Maria.
- Preserve task idempotency and the existing provider-neutral `VoiceAgentClient` boundary.

### Task 4: Focused tests and verification
- Unit-test attempts 1 to 3, rejection of attempt 4, and the two minimum retry delays.
- Unit-test retryable vs terminal dispositions, including that `needs_human` and confirmed/declined calls do not retry.
- Unit-test the boutique window at its start, just before its end, exactly at its end, outside the window, and the next opening after a due time falls outside business hours.
- Test that `canLaunchCall: false` or a capacity API failure defers dispatch without incrementing the attempt, and that `canLaunchCall: true` permits dispatch.
- Test that queue endpoints and direct dispatch cannot bypass the policy, and that concurrent enqueue attempts do not duplicate an `(orderId, attempt)` pair.
- Run focused calls/voice unit tests, backend typecheck/lint, and Prisma migration validation.

## Definition of done

- No order receives more than three call attempts.
- Attempts 1, 2, and 3 are all scheduled and launched automatically when eligible; operator queue/dispatch actions are not required.
- Dispatch occurs only when Ringio reports `canLaunchCall: true`; unavailable capacity keeps the same pending attempt for a later poll without incrementing the attempt.
- Retries cannot start earlier than 30 minutes after attempt 1 completes or 2 hours after attempt 2 completes.
- Maria is never dispatched outside the boutique's configured daily window in `Africa/Tunis`; work that becomes due after closing is deferred to the next calendar day's opening.
- Only policy-approved outcomes retry; human-review and completed business outcomes stop automation.
- Existing callback, artifact, tenant-scoping, and provider-neutrality behavior remains intact.

## Assumption to confirm before execution

The current `Boutique` model has no per-shop IANA timezone. Its schema documents `callStartTime` and `callEndTime` as `Africa/Tunis`, so this plan interprets the configured hours as Tunis local time. If boutiques can use other timezones, add a per-boutique IANA timezone before implementing the scheduler.