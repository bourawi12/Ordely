# User Stories — Ordely

> One story = one shippable slice, written to be executed by an agent.
> Id format: `s<number>-<short-slug>` — reused in every pipeline file and in the branch name.

## Story s01-voice-integration — Simulated Voice Call Integration (Ordely ↔ Ringio)
**As a** shop owner / operator **I want** queued confirmation call attempts to dispatch to the simulated Ringio/Gemini voice agent, carry context, stream transcripts, store audio artifacts, and record business dispositions **so that** we can validate automated phone order confirmation workflows safely without touching real carrier networks.

### Complexity
3 (PRD scale: integration story across port/adapter boundaries, outbox dispatch, callback auth, and artifact persistence).

### Acceptance criteria
- [ ] Provider-neutral `VoiceAgentClient` port defined with DIP/LSP so Ordely has zero WebRTC or Gemini dependencies.
- [ ] Database schema migration adds `taskId`, `providerCallId`, `transportPhase`, `disposition`, `failureReason`, and relations for `CallRecording` and `CallTranscriptEntry` without breaking existing `Call` fields.
- [ ] `CallDispatcherService` dispatches pending calls to the agent via `RingioAdapter` with idempotency.
- [ ] Internal authenticated callback endpoints receive lifecycle events (`ringing`, `connected`, `ended`, `error`), transcript lines, and structured dispositions.
- [ ] Finalized WAV audio files are stored via Ordely's `StorageService` in MinIO, tenant-scoped, and served via short-lived signed URLs.
- [ ] Human review gate preserved: automated calls never auto-confirm an order without explicit review.
- [ ] Tests for dispatch, adapter, callbacks, and artifact storage pass without regressions.

### Dependencies
- Existing `CallsModule`, `StorageService`, and Ringio `mock-external-service`.

### Agentic notes
- Ordely `Call.id` is integer; Ringio `callId` is UUID. Do not alter Ordely primary key.
- Concurrency starts at 1 for the test phase (Ponytail: YAGNI on distributed queue/complex brokers).
- Follow Ponytail ladder: shortest diff that works, reuse existing `StorageService` and `PrismaService`, avoid redundant serialization layers.
