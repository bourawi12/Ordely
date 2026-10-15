# Maria: Ordely's Voice Agent

## What Maria is

Maria is Ordely's customer-facing AI voice agent for confirming pending orders. She speaks mainly Tunisian Derja, with natural French where useful, reads the order details, checks the delivery address, and asks whether the customer confirms. She can clarify an unclear response and reports `CONFIRMED`, `CANCELLED`, or `UNCLEAR` with a confidence score and language.

Maria handles the conversation; she does not update orders. Ordely's backend checks the result against its confidence threshold and current order state before applying any change. Unclear results follow the retry and human-review policy.

## What she uses

- **Gemini Live** (`@google/genai`) for realtime speech understanding and generated audio. The session also receives input/output transcripts and exposes `report_decision` and `end_call` tools.
- **A voice runtime** to manage the call, stream audio, handle interruptions and session errors, and wait for spoken audio to finish before ending the call.
- **Ringio and WebRTC** for the simulated call connection to the test mobile app. Socket.IO carries call signaling; WebRTC carries audio.
- **Ordely callbacks and artifact storage** for call status, transcripts, recordings, and the structured decision.

The system instruction and order context guide the conversation. Customer and order data must be treated as data, not as instructions.

## What she needs to run

- Node.js 22 or newer and the backend/runtime dependencies installed.
- A valid `GEMINI_API_KEY` and network access to Gemini Live.
- A reachable Ringio call server, valid ICE configuration, and an available test phone running the mobile app.
- A simulated destination number and, when connected to Ordely, configured callback credentials and artifact storage.

Keep calls on simulated numbers in development. Real telephone calling requires a separate, explicitly reviewed deployment and compliance setup.

## Why Maria exists

Order confirmation is repetitive and often needs a quick two-way exchange: customers can be busy, correct an address, ask about an item, or answer ambiguously. Maria can handle that conversation in the customer's local language and return a consistent result, while Ordely retains control of order policy, retries, audit history, and database writes. This is an assistive workflow, not permission for the model to make unreviewed business changes.

## How to evolve her

1. **Measure first:** build a reviewed set of Tunisian Derja, French, mixed-language, noisy-audio, correction, refusal, and ambiguous-response scenarios. Track intent accuracy, address completion, call completion, latency, and cost.
2. **Make outcomes explicit:** validate model tool arguments and consider returning verified address details and follow-up needs as structured fields; today, address verification is conversational, while the decision tool returns intent, confidence, and language.
3. **Improve safely:** version prompts, test every prompt/model change against the scenario set, preserve backend authorization of order changes, and route low-confidence or exceptional cases to staff.
4. **Protect customers:** set clear recording notices, access controls, and retention limits for transcripts and audio before expanding beyond simulated calls.
5. **Scale deliberately:** add language/provider options and more call capacity only after reliability, quality, and operating cost are measured.

## Code map

- `backend/src/voice/runtime/geminiLiveSession.js`: Gemini model session, instructions, audio events, and tool definitions.
- `backend/src/voice/runtime/voiceCallAgent.js`: call lifecycle, audio bridge, transcript handling, and decision reporting.
- `backend/src/voice/adapters/ringio.adapter.ts`: starts the runtime and supplies its environment and task data.
- `backend/src/voice/callbacks/`: validates callbacks and applies the backend's decision policy.



