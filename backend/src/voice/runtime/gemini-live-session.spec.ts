const { GeminiLiveSession } = require('./geminiLiveSession');

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