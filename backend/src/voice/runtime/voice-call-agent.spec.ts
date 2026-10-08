const { VoiceCallAgent } = require('./voiceCallAgent');

describe('VoiceCallAgent decision reporting', () => {
  function createAgent() {
    const order: string[] = [];
    const gemini = { acknowledgeTool: jest.fn() };
    const bridge = {
      flushOutput: jest.fn(() => order.push('flush')),
      waitForOutputDrain: jest.fn(async () => order.push('drained')),
    };
    const agent = new VoiceCallAgent({
      serverUrl: 'http://127.0.0.1:9',
      destinationNumber: '+15550001234',
      ioClient: () => {},
      wrtc: {},
      geminiFactory: async () => gemini,
      artifactStore: {},
      artifactClient: {},
      logger: { info() {}, warn() {}, error() {} },
    });
    agent.gemini = gemini;
    agent.bridge = bridge;
    agent.stop = jest.fn(async () => order.push('hangup'));
    return { agent, bridge, gemini, order };
  }

  it('waits for Maria to signal end_call after reporting the decision', async () => {
    const { agent, bridge, gemini, order } = createAgent();
    const args = { intent: 'CONFIRMED', confidence: 0.9, language: 'TUNISIAN_ARABIC' };

    agent.recordDecision({ id: 'tool-1', name: 'report_decision', args });
    expect(agent.decision).toEqual(args);
    expect(gemini.acknowledgeTool).toHaveBeenCalledWith('tool-1', 'report_decision');
    expect(agent.stop).not.toHaveBeenCalled();

    await agent.handleGeminiEvent({ type: 'turn-complete' });
    expect(agent.stop).not.toHaveBeenCalled();

    await agent.handleGeminiEvent({ type: 'end-call', id: 'tool-2', name: 'end_call', args: {} });
    expect(gemini.acknowledgeTool).toHaveBeenCalledWith('tool-2', 'end_call');
    await agent.handleGeminiEvent({ type: 'turn-complete' });

    expect(bridge.flushOutput).toHaveBeenCalledTimes(2);
    expect(order).toEqual(['flush', 'drained', 'flush', 'drained', 'hangup']);
  });

  it('fails closed on invalid intent or confidence', () => {
    const { agent } = createAgent();

    agent.recordDecision({
      id: 'tool-2',
      name: 'report_decision',
      args: { intent: 'MAYBE', confidence: 1.2, language: 'OTHER' },
    });

    expect(agent.decision).toEqual({ intent: 'UNCLEAR', confidence: 0, language: undefined });
  });
});
