import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

describe('IntegrationsService', () => {
  const integration = {
    id: 4,
    boutiqueId: 7,
    name: 'Custom website API',
    apiKeyHash: '',
    apiKeyPrefix: 'ordely_live_abc',
    enabled: true,
  };
  const prisma = {
    integration: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    order: {
      findFirst: jest.fn(),
    },
  };
  const ordersService = { create: jest.fn() };
  let service: IntegrationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IntegrationsService(prisma as never, ordersService as never);
  });

  it('creates a custom API key and only returns it at creation time', async () => {
    prisma.integration.findUnique.mockResolvedValue(null);
    prisma.integration.create.mockImplementation(async ({ data }) => ({
      ...integration,
      ...data,
    }));

    const result = await service.createCustomApiConnection(7, {});

    expect(result.apiKey).toMatch(/^ordely_live_[a-f0-9]{48}$/);
    expect(result.warning).toContain('not be shown again');
    expect(prisma.integration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ boutiqueId: 7, apiKeyHash: expect.any(String) }),
      }),
    );
  });

  it('rejects a second integration for the same shop', async () => {
    prisma.integration.findUnique.mockResolvedValue(integration);

    await expect(service.createCustomApiConnection(7, {})).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects missing or invalid API keys', async () => {
    await expect(
      service.ingestExternalOrder(undefined, {} as never),
    ).rejects.toThrow(UnauthorizedException);

    prisma.integration.findUnique.mockResolvedValue(null);
    await expect(
      service.ingestExternalOrder('bad-key', {} as never),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('returns the existing order for a duplicate external order ID', async () => {
    prisma.integration.findUnique.mockResolvedValue(integration);
    prisma.order.findFirst.mockResolvedValue({
      id: 22,
      status: 'pending',
      externalOrderId: 'shop-22',
    });

    await expect(
      service.ingestExternalOrder('ordely_live_test', {
        externalOrderId: 'shop-22',
      } as never),
    ).resolves.toMatchObject({ id: 22, duplicate: true });
    expect(ordersService.create).not.toHaveBeenCalled();
  });
});