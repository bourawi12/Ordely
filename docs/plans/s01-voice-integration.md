---
validated: yes
---
# Plan — Story s01-voice-integration

Branch: `feature/s01-voice-integration`  
Research: `docs/research/s01-voice-integration.md` — read it first; this plan does not repeat it.

## Target story
Connect Ordely's confirmation call queue to its own Gemini/WebRTC worker, which connects directly to Ringio's VoIP server on port 4100. Keep durable correlation, authenticated callbacks, transcript persistence, and private per-speaker audio storage without carrier/telephony dependencies. The separate Ringio mock-external-service is not part of the Ordely runtime path.

## Tasks (ordered)

### Task 1: Contracts and Interfaces (DIP / ISP)
- [x] 1.1 Create `backend/src/voice/voice.types.ts` (`VoiceCallTask`, `VoiceCallEvent`, `VoiceCallResult`, `TranscriptEntry`, `VoiceDisposition`).
- [x] 1.2 Create `backend/src/voice/voice-agent-client.interface.ts` with `VoiceAgentClient` port and `VOICE_AGENT_CLIENT` injection token.
- [x] 1.3 Create `backend/src/voice/adapters/fake-voice-agent-client.ts` as a test double (LSP).

### Task 2: Schema Migration & Persistence (SRP)
- [x] 2.1 Update `backend/prisma/schema.prisma` with `taskId`, `providerCallId`, `transportPhase`, `disposition`, `failureReason`, `dispatchedAt`, `completedAt`, `isSimulated`, and models `CallRecording` and `CallTranscriptEntry`.
- [x] 2.2 Generate Prisma client and create migration.
- [x] 2.3 Extend `CallsService.findOne()` to include `recordings` and `transcriptEntries`.

### Task 3: Call Dispatcher & Voice Worker Adapter (OCP / DIP)
- [x] 3.1 Implement `RingioAdapter` to launch the Ordely-owned voice worker as a child process.
- [x] 3.2 Create `backend/src/voice/call-dispatcher.service.ts` to dispatch pending calls with concurrency bound = 1.
- [x] 3.3 Create `backend/src/voice/voice.module.ts` wiring the dispatcher and adapter into `app.module.ts`.
- [x] 3.4 Test worker task context, duplicate rejection, graceful stop, and failure callbacks.

### Task 4: Internal Callback & Artifact Endpoints (SRP / Security)
- [x] 4.1 Create `backend/src/voice/callbacks/call-callback.guard.ts` (Bearer token auth for internal services).
- [x] 4.2 Create `backend/src/voice/callbacks/call-callback.service.ts` & `call-callback.controller.ts` for lifecycle events and dispositions.
- [x] 4.3 Create `backend/src/voice/artifacts/call-artifact.service.ts` & `call-artifact.controller.ts` for saving transcript entries and WAV files into `StorageService`.
- [x] 4.4 Add unit tests for callback reconciliation and artifact uploads.

### Task 5: Ordely-Owned Voice Runtime
- [x] 5.1 Host the Gemini/WebRTC worker modules under `backend/src/voice/runtime/`; Nest launches the JS entrypoint as a child and does not import media modules.
- [x] 5.2 Connect the worker directly to `CALL_SERVER_URL` and post authenticated lifecycle events, transcripts, and finalized WAV files to Ordely.
- [x] 5.3 Pass the synthetic order scenario to Gemini and keep ordinary call completion in the human-review state.

### Task 6: End-to-End Verification & Verification Record
- [x] 6.1 Run backend unit tests and linting.
- [x] 6.2 Verify Ringio mock service tests pass.
- [x] 6.3 Write verification record in `docs/verif/s01-voice-integration.md`.

## Run interdicts
- Do NOT import WebRTC, Socket.IO, or `@google/genai` packages into the NestJS backend.
- Do NOT alter Ordely's primary key (`Call.id` must remain `Int`).
- Do NOT alter `AudioMediaBridge` sample rates or audio pacing in Ringio (preserves audio baseline).
- Do NOT add external broker/queue dependencies (Redis/RabbitMQ/Bull) for the single-agent test phase (Ponytail YAGNI).
- Do NOT bypass tenant scoping on `CallRecording` or `CallTranscriptEntry`.

## The point everything turns on
The contract boundaries:
1. `VoiceAgentClient` port in NestJS must remain completely provider-agnostic.
2. The callback token authentication must securely isolate internal endpoints.
3. Audio files must be stored directly via `StorageService` without buffering beyond normal request bounds.

## Files touched
- `backend/prisma/schema.prisma`
- `backend/src/app.module.ts`
- `backend/src/calls/calls.service.ts`
- `backend/src/voice/*` (new module)
- `backend/src/voice/runtime/*`
- `backend/package.json` and `backend/package-lock.json`
- `backend/Dockerfile`, `backend/nest-cli.json`, `docker-compose.yml`, and backend env example
- `docs/verif/s01-voice-integration.md`

## Test strategy
- Unit tests for `CallDispatcherService` mocking `VoiceAgentClient`.
- Unit tests for `CallCallbackService` testing idempotent lifecycle transitions and invalid states.
- Unit tests for `CallArtifactService` with mocked `StorageService` and `PrismaService`.
- Ringio existing test suite `node --test` in `Ringio/mock-external-service/`.

## Definition of Done
- Clean diff on branch `feature/s01-voice-integration`.
- All unit tests pass.
- Verification record completed.
- Review passes with zero critical severity issues.
