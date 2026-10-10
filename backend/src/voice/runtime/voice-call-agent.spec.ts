const { VoiceCallAgent } = require('./voiceCallAgent');

describe('VoiceCallAgent decision reporting', () => {
  function createAgent() {
    const order: string[] = [];
    const timers: Array<{ callback: () => unknown; delay: number; cancelled: boolean }> = [];
    const gemini = { acknowledgeTool: jest.fn(), speak: jest.fn() };
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
      artifactClient: { appendTranscript: jest.fn().mockResolvedValue(undefined) },
      logger: { info() {}, warn() {}, error() {} },
      scheduleTimer: (callback: () => unknown, delay: number) => {
        const timer = { callback, delay, cancelled: false };
        timers.push(timer);
        return timer;
      },
      cancelTimer: (timer: { cancelled: boolean }) => { timer.cancelled = true; },
    });
    agent.gemini = gemini;
    agent.bridge = bridge;
    agent.stop = jest.fn(async () => order.push('hangup'));
    return { agent, bridge, gemini, order, timers };
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

    expect(agent.decision).toEqual({ intent: 'UNCLEAR', confidence: 0, language: 'TUNISIAN_ARABIC' });
  });

  it('acknowledges silence with a Tunisian Derja prompt and resets the watchdog', async () => {
    const { agent, gemini, timers } = createAgent();
    agent.greetingComplete = true;

    agent.resetCustomerSilenceTimer();
    expect(timers[0].delay).toBe(12000);
    await timers[0].callback();

    expect(gemini.speak).toHaveBeenCalledWith('اسأل الحريف بلطف: ألو، تسمع فيّا؟');
    expect(timers).toHaveLength(2);
  });

  it('resets customer silence after mobile speech and clears it after a decision', () => {
    const { agent, timers } = createAgent();
    agent.greetingComplete = true;

    agent.resetCustomerSilenceTimer();
    const firstTimer = timers[0];
    agent.handleGeminiEvent({ type: 'transcript', speaker: 'mobile', text: 'نعم' });

    expect(firstTimer.cancelled).toBe(true);
    expect(timers).toHaveLength(2);
    agent.recordDecision({ id: 'tool-1', name: 'report_decision', args: { intent: 'CONFIRMED', confidence: 1 } });
    expect(timers[1].cancelled).toBe(true);
  });

  it('forces an UNCLEAR decision and cleanup at the maximum call duration', async () => {
    const { agent, timers } = createAgent();
    agent.finish = jest.fn().mockResolvedValue(undefined);
    agent.startCallDurationTimer();

    expect(timers[0].delay).toBe(240000);
    await timers[0].callback();

    expect(agent.decision).toEqual({ intent: 'UNCLEAR', confidence: 0, language: 'TUNISIAN_ARABIC' });
    expect(agent.finish).toHaveBeenCalledWith('Maximum call duration reached.', 'timeout');
  });
});
