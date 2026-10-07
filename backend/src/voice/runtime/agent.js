const { io } = require('socket.io-client');
const wrtc = require('@roamhq/wrtc');
const { AudioArtifactStore } = require('./audioArtifactStore');
const { CallArtifactClient } = require('./callArtifactClient');
const { GeminiLiveSession } = require('./geminiLiveSession');
const { VoiceCallAgent } = require('./voiceCallAgent');
const { OrdelyCallbackClient } = require('./ordelyCallbackClient');

async function getIceServers(serverUrl) {
  const response = await fetch(`${serverUrl.replace(/\/$/, '')}/api/ice-config`);
  if (!response.ok) throw new Error(`Could not load ICE configuration (${response.status}).`);
  const config = await response.json();
  if (!Array.isArray(config.iceServers) || config.iceServers.length === 0) {
    throw new Error('The call server returned no ICE servers.');
  }
  return config.iceServers;
}

async function main() {
  const serverUrl = process.env.CALL_SERVER_URL;
  const destinationNumber = process.env.SIMULATED_DESTINATION_NUMBER;
  if (!serverUrl) throw new Error('CALL_SERVER_URL is required.');
  if (!destinationNumber) throw new Error('SIMULATED_DESTINATION_NUMBER is required.');
  if (process.env.NODE_ENV === 'production' && !process.env.VOICE_RECORDINGS_DIR) {
    throw new Error('VOICE_RECORDINGS_DIR must point to durable mounted storage in production.');
  }

  const taskId = process.env.VOICE_TASK_ID || null;
  const task = JSON.parse(process.env.CALL_TASK || '{}');
  const ordelyClient = taskId ? new OrdelyCallbackClient() : null;

  const iceServers = await getIceServers(serverUrl);
  const agent = new VoiceCallAgent({
    serverUrl,
    destinationNumber,
    availabilityPolicy: process.env.CALL_AVAILABILITY_POLICY || 'reject',
    iceServers,
    ioClient: io,
    wrtc,
    geminiFactory: () => GeminiLiveSession.connect({ scenario: task.scenario }),
    artifactStore: new AudioArtifactStore(),
    artifactClient: new CallArtifactClient({ serverUrl }),
    onStatus: (phase) => process.send?.({ type: 'agent-status', phase }),
    taskId,
    ordelyClient,
  });

  process.once('SIGINT', () => { agent.stop().catch((error) => console.error(error)); });
  process.once('SIGTERM', () => { agent.stop().catch((error) => console.error(error)); });
  const result = await agent.start();
  console.log(result.message);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
