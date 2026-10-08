const { GeminiLiveSession, normalizeLiveMessage } = require('./geminiLiveSession');

describe('GeminiLiveSession decision reporting', () => {
  it('provides order-specific decision instructions and acknowledges the tool call', async () => {
    let options: any;
    const session = { sendToolResponse: jest.fn(), close: jest.fn() };
    const client = {
      live: {
        connect: jest.fn((config) => {
          options = config;
          queueMicrotask(() => config.callbacks.onmessage({ setupComplete: {} }));
          return Promise.resolve(session);
        }),
      },
    };
    const scenario = { orderRef: 'ORD-7', customer: 'Ines' };
    const live = await GeminiLiveSession.connect({ client, scenario });
    const instruction = options.config.systemInstruction;

    expect(options.config.tools[0].functionDeclarations[0].name).toBe('report_decision');
    expect(instruction).toContain('one or two brief, natural clarifying questions');
    expect(instruction).toContain('say plainly that the order is confirmed or cancelled');
    expect(instruction).toContain('After your spoken closing, call report_decision exactly once');

    live.acknowledgeTool('tool-1', 'report_decision');
    expect(session.sendToolResponse).toHaveBeenCalledWith({
      functionResponses: [{
        id: 'tool-1',
        name: 'report_decision',
        response: { result: 'Decision recorded. Do not speak further.' },
      }],
    });
  });

  it('normalizes report_decision before turn completion', () => {
    expect(normalizeLiveMessage({
      toolCall: {
        functionCalls: [{
          id: 'tool-1',
          name: 'report_decision',
          args: { intent: 'CONFIRMED', confidence: 0.9, language: 'TUNISIAN_ARABIC' },
        }],
      },
      serverContent: { turnComplete: true },
    })).toEqual([
      {
        type: 'decision',
        id: 'tool-1',
        name: 'report_decision',
        args: { intent: 'CONFIRMED', confidence: 0.9, language: 'TUNISIAN_ARABIC' },
      },
      { type: 'turn-complete' },
    ]);
  });
});

describe('GeminiLiveSession.connect', () => {
  it('reports a close before the session connection promise resolves', async () => {
    let callbacks: any;
    const client = {
      live: {
        connect: jest.fn((options) => {
          callbacks = options.callbacks;
          return new Promise(() => {});
        }),
      },
    };

    const connecting = GeminiLiveSession.connect({ client });
    callbacks.onclose({ code: 1008, reason: Buffer.from('policy violation') });

    await expect(connecting).rejects.toThrow(
      'Gemini Live session closed (1008): policy violation.',
    );
  });
});