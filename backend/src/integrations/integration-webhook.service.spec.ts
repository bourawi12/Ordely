import { PrismaService } from '../prisma/prisma.service';
import { IntegrationWebhookService } from './integration-webhook.service';

describe('IntegrationWebhookService', () => {
  const integration = {
    findUnique: jest.fn(),
  };
  const order = {
    findFirst: jest.fn(),
  };
  let service: IntegrationWebhookService;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IntegrationWebhookService({ integration, order } as unknown as PrismaService);
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    );
  });

  afterEach(() => fetchMock.mockRestore());

  it('posts the external order status to its boutique callback URL', async () => {
    integration.findUnique.mockResolvedValue({
      webhookUrl: 'https://shop.example.test/ordely/status',
      webhookSecret: 'test-secret',
      enabled: true,
    });
    order.findFirst.mockResolvedValue({
      id: 42,
      externalOrderId: 'shop-order-1001',
    });

    await service.publish({ boutiqueId: 7, orderId: 42, status: 'confirmed' });

    expect(order.findFirst).toHaveBeenCalledWith({
      where: { id: 42, boutiqueId: 7 },
      select: { id: true, externalOrderId: true },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://shop.example.test/ordely/status',
      expect.objectContaining({ method: 'POST' }),
    );
    const [, request] = fetchMock.mock.calls[0];
    const payload = JSON.parse(String(request?.body));
    expect(payload).toMatchObject({
      event: 'order.confirmed',
      order: {
        ordelyOrderId: 42,
        externalOrderId: 'shop-order-1001',
        status: 'confirmed',
      },
    });
    expect(request?.headers).toHaveProperty('X-Ordely-Signature');
  });

  it('does not send when no callback URL is configured', async () => {
    integration.findUnique.mockResolvedValue({
      webhookUrl: null,
      webhookSecret: 'test-secret',
      enabled: true,
    });

    await service.publish({ boutiqueId: 7, orderId: 42, status: 'cancelled' });

    expect(order.findFirst).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});