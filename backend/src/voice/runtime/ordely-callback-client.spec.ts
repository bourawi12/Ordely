const { OrdelyCallbackClient } = require('./ordelyCallbackClient');

describe('OrdelyCallbackClient.sendResult', () => {
  it('sends Maria intent and confidence without assuming confirmation', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    const client = new OrdelyCallbackClient({
      callbackUrl: 'http://ordely.test/api',
      callbackSecret: 'secret',
      logger: { info() {}, warn() {}, error() {} },
    });

    try {
      await client.sendResult({
        taskId: 'call-7',
        disposition: 'completed',
        intent: 'CONFIRMED',
        confidence: 0.9,
        language: 'TUNISIAN_ARABIC',
      });

      const [, request] = fetchMock.mock.calls[0];
      expect(JSON.parse(request.body)).toMatchObject({
        taskId: 'call-7',
        disposition: 'completed',
        intent: 'CONFIRMED',
        confidence: 0.9,
        language: 'TUNISIAN_ARABIC',
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('defaults to completed rather than confirmed', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    const client = new OrdelyCallbackClient({
      callbackUrl: 'http://ordely.test/api',
      logger: { info() {}, warn() {}, error() {} },
    });

    try {
      await client.sendResult({ taskId: 'call-8' });
      const [, request] = fetchMock.mock.calls[0];
      expect(JSON.parse(request.body).disposition).toBe('completed');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
