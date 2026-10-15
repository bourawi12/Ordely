# Maria and the Order Confirmation Conversation

## Maria's role

Maria is the AI voice representative in Ordely's order-confirmation process. Her job is to have a short, polite conversation with the customer, explain the order, listen to the response, and report what she understood. She does not decide on her own whether Ordely changes an order.

At a high level, the process is:

1. Ordely selects a pending order and prepares a small summary for the call.
2. Maria receives that summary together with conversation guidance.
3. She speaks with the customer in Tunisian Derja, naturally mixing in French where appropriate.
4. Maria reports whether the customer confirmed, declined, or gave an unclear answer.
5. Ordely checks that report against its own rules and the current order status before making any change.

## The AI model

Maria's conversation is powered by Gemini Live, a Google AI model designed to handle an ongoing voice conversation. It receives the customer's speech as the conversation happens and can return spoken replies and a transcript. The current model is selected through configuration, with a default specified in the application.

The model is only one part of the system. The surrounding voice software sends it the instructions and order summary, carries audio to and from the conversation, handles its requested actions, and sends the final result to Ordely. The model itself cannot directly edit an order.

## What Maria is told

Maria receives two kinds of guidance:

- **Conversation policy:** her role and tone, preferred languages, when she may share order details, how to handle a busy customer or an unclear answer, and how to close the conversation.
- **Call-specific context:** a summary that can include the order reference, customer name, items and quantities, total, preferred language, shop name, and confirmation-process details.

The call-specific summary is supplied as data to discuss, not as a way for customer-provided text to replace Maria's core conversation policy. The policy asks her to check availability first, avoid treating availability as confirmation, distinguish an address correction from a cancellation, and report uncertainty rather than guess.

## What the two actions mean

Maria can request two structured actions during a call:

- **Report the decision:** provide one of three outcomes—confirmed, cancelled, or unclear—along with a confidence score and the main language used. The voice software checks that the values are in the expected format and passes the result to Ordely.
- **End the call:** signal that the spoken closing is complete. The voice software coordinates the actual call ending after the decision and closing sequence.

These actions do not give Maria direct access to Ordely's database. Ordely applies its own confidence threshold and only changes an order that is still pending. A model-reported confidence is useful input, not a guarantee of correctness; unclear or low-confidence outcomes are not treated as confirmation.


## For implementation detail

- [How the order summary is prepared](../../backend/src/calls/orchestration/call-dispatcher.service.ts)
- [Call summary and result fields](../../backend/src/voice/voice.types.ts)
- [Model instructions and available actions](../../backend/src/voice/runtime/geminiLiveSession.js)
- [How the call receives its summary](../../backend/src/voice/runtime/agent.js)
- [How actions affect the call](../../backend/src/voice/runtime/voiceCallAgent.js)
- [Ordely's decision rules](../../backend/src/voice/voice.rules.ts)
- [How Ordely applies a reported result](../../backend/src/voice/voice-callbacks.service.ts)