# Research — Story s01-voice-integration

Branch: `feature/s01-voice-integration`  
Story: `docs/stories.md#story-s01-voice-integration`  

## 1. Codebase state & verified touch points

### Ordely Backend (NestJS 10 + Prisma 6)
- **Call model**: `backend/prisma/schema.prisma` (`Call` model, lines 35-52). Primary key `id Int @id @default(autoincrement())`. Statuses: `pending`, `confirmed`, `failed`, `no_answer`. Has `orderId`, `attempt`, `durationSeconds`, `language`, `transcript` (Json), `recordingUrl`.
- **CallsService**: `backend/src/calls/calls.service.ts`. Methods: `list`, `exportCsv`, `findOne`, `update`, `queue`, `queueAllPending`, `usage`. All queries scoped to `order.boutiqueId`.
- **CallsController**: `backend/src/calls/calls.controller.ts`. Endpoints: `GET /calls`, `GET /calls/export`, `GET /calls/usage`, `GET /calls/:id`, `PATCH /calls/:id`, `POST /calls`, `POST /calls/queue-pending`.
- **StorageService**: `backend/src/storage/storage.service.ts`. Connects to MinIO/S3 via `minio` client. Provides `put(key, body, contentType)`, `remove(key)`, `url(key)` (presigned GET with 1-hour TTL), `isUp()`. Bucket: `S3_BUCKET` (default `ordely-media`).

### Ringio Voice Agent Runtime
- **Mock Service / Control API**: `Ringio/mock-external-service/mock-service.js`. Runs on `127.0.0.1:4200`. Currently spawns `agent.js` child process with `SIMULATED_DESTINATION_NUMBER`, `CALL_SERVER_URL`, `CALL_AVAILABILITY_POLICY`. Single process constraint (`agentProcess`).
- **VoiceCallAgent**: `Ringio/mock-external-service/voiceCallAgent.js`. Handles Socket.IO signaling, WebRTC negotiation, Gemini session, and artifact writes.
- **Audio artifacts**: `Ringio/mock-external-service/audioArtifactStore.js` writes per-speaker WAV files (`agent.wav`, `mobile.wav`) locally under `recordings/<call-id>/`.

## 2. Key Architectural Invariants & Traps

| Constraint / Trap | Why it matters | Correct handling |
|---|---|---|
| ID type mismatch | Ordely `Call.id` is `Int`; Ringio `callId` is `UUID`. | Persist Ringio UUID in `providerCallId`; keep `Call.id` as integer. |
| Dependency isolation | Ordely must not know WebRTC, Socket.IO, or Gemini SDK. | Invert dependencies via `VoiceAgentClient` interface in `backend/src/voice/`. |
| Concurrency limit | Mock service only runs 1 child agent process at a time. | Limit Ordely dispatcher concurrency to 1. |
| Object storage reuse | MinIO exists and is configured in `StorageService`. | Store WAV files in MinIO using `calls/{boutiqueId}/{callId}/{speaker}.wav` keys. |
| Re-running suites | Overzealous check repetitions waste cycle time. | Adhere to killer-saas rule: test each invariant once; verify with record. |
| Audio regressions | Ringio audio quality and cadence must not break. | Keep `AudioMediaBridge` and PCM settings untouched. |

## 3. Ponytail Ladders Applied (YAGNI & Anti-Overengineering)

1. **Outbox table vs. Call table**: No separate outbox table. `Call` already holds status, attempt, and order info. Adding `taskId`, `dispatchedAt`, and `transportPhase` to `Call` is the shortest working diff.
2. **Streaming vs. Buffer**: Average test call WAV is ~10-15MB. `StorageService.put(key, buffer, contentType)` handles this in standard Node memory. No complex multi-part stream needed.
3. **Checksums & Replay Caches**: Deferred. Single shared bearer token for internal callback authentication on localhost/Docker network.
4. **Per-speaker UI redesign**: Deferred to follow-up polish story. First story focuses entirely on data flow, persistence, and verification.

## 4. Complexity & Feasibility
- Re-scored complexity: **3** (Comfortable for a single focused story when using port/adapter pattern and Ponytail simplifications).
- Feasibility: 100% verified against running code.
