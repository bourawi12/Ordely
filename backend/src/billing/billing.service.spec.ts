import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { currentPlan, recommendedPlan } from './billing.rules';
import { BillingService } from './billing.service';

describe('billing rules', () => {
  it('recommends the plan that fits the declared daily volume', () => {
    expect(recommendedPlan('lt20').code).toBe('free');
    expect(recommendedPlan('20_50').code).toBe('starter');
    expect(recommendedPlan('50_100').code).toBe('growth');
    expect(recommendedPlan('100_300').code).toBe('pro');
    expect(recommendedPlan('gt300').code).toBe('pro');
    // No answer (the screen is optional), or an unknown code: free.
    expect(recommendedPlan(null).code).toBe('free');
    expect(recommendedPlan('lots').code).toBe('free');
  });

  it('treats a shop as free until its paid plan runs, and again once cancelled', () => {
    const started = new Date();
    expect(
      currentPlan({ plan: null, planStartedAt: null, churnedAt: null }).code,
    ).toBe('free');
    expect(
      currentPlan({ plan: 'growth', planStartedAt: started, churnedAt: null })
        .code,
    ).toBe('growth');
    expect(
      currentPlan({
        plan: 'growth',
        planStartedAt: started,
        churnedAt: new Date(),
      }).code,
    ).toBe('free');
  });
});

describe('BillingService', () => {
  const boutique = { findUnique: jest.fn(), update: jest.fn() };
  const payment = { create: jest.fn() };
  const $transaction = jest.fn((ops: unknown[]) => Promise.all(ops));
  const prisma = {
    boutique,
    payment,
    $transaction,
  } as unknown as PrismaService;
  const service = (env: Record<string, string>) =>
    new BillingService(prisma, {
      get: (k: string) => env[k],
    } as unknown as ConfigService);
  const shop = {
    id: 7,
    dailyOrderVolume: '20_50',
    plan: null,
    planStartedAt: null,
    churnedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    boutique.findUnique.mockResolvedValue(shop);
    boutique.update.mockResolvedValue(shop);
    payment.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 1, ...data }),
    );
  });

  it('lists the plans with the recommended and current one, flagged as test mode', async () => {
    await expect(
      service({ PAYMENTS_PROVIDER: 'simulated' }).plans(7),
    ).resolves.toMatchObject({
      recommended: 'starter',
      current: 'free',
      payments: { available: true, testMode: true },
    });
  });

  it('takes the free plan without any payment', async () => {
    await expect(
      service({ PAYMENTS_PROVIDER: 'simulated' }).subscribe(7, {
        plan: 'free',
      }),
    ).resolves.toEqual({
      plan: 'free',
      payment: null,
    });
    expect(payment.create).not.toHaveBeenCalled();
    expect(boutique.update).not.toHaveBeenCalled();
  });

  it('charges one month and starts the plan together on a successful payment', async () => {
    const result = await service({ PAYMENTS_PROVIDER: 'simulated' }).subscribe(
      7,
      {
        plan: 'starter',
        paymentToken: 'tok_test_visa',
      },
    );
    expect(result).toMatchObject({
      plan: 'starter',
      payment: {
        amount: 79,
        currency: 'TND',
        cardLast4: '4242',
        testMode: true,
      },
    });
    expect(payment.create.mock.calls[0][0].data).toMatchObject({
      boutiqueId: 7,
      plan: 'starter',
      amount: 79,
      provider: 'simulated',
      status: 'succeeded',
    });
    expect(boutique.update.mock.calls[0][0]).toMatchObject({
      where: { id: 7 },
      data: {
        plan: 'starter',
        planStartedAt: expect.any(Date),
        churnedAt: null,
      },
    });
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it('records a declined card and leaves the plan alone', async () => {
    await expect(
      service({ PAYMENTS_PROVIDER: 'simulated' }).subscribe(7, {
        plan: 'pro',
        paymentToken: 'tok_test_declined',
      }),
    ).rejects.toMatchObject({
      status: 402,
      message: 'Your card was declined.',
    });
    expect(payment.create.mock.calls[0][0].data).toMatchObject({
      status: 'failed',
      failureReason: 'card_declined',
      amount: 449,
    });
    expect(boutique.update).not.toHaveBeenCalled();
  });

  it('refuses a paid plan without a payment method or with an unknown card', async () => {
    const billing = service({ PAYMENTS_PROVIDER: 'simulated' });
    await expect(billing.subscribe(7, { plan: 'starter' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      billing.subscribe(7, { plan: 'starter', paymentToken: 'tok_made_up' }),
    ).rejects.toThrow(BadRequestException);
    expect(payment.create).not.toHaveBeenCalled();
    expect(boutique.update).not.toHaveBeenCalled();
  });

  it('sells no paid plan when payments are not configured, or simulated in production', async () => {
    const unavailable: Record<string, string>[] = [
      {},
      { PAYMENTS_PROVIDER: 'simulated', NODE_ENV: 'production' },
      { PAYMENTS_PROVIDER: 'paypal' },
    ];
    for (const env of unavailable) {
      const billing = service(env);
      await expect(billing.plans(7)).resolves.toMatchObject({
        payments: { available: false, testMode: false },
      });
      await expect(
        billing.subscribe(7, {
          plan: 'starter',
          paymentToken: 'tok_test_visa',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    }
    expect(boutique.update).not.toHaveBeenCalled();
  });

  it('cancels a running paid plan when the shop goes back to free', async () => {
    boutique.findUnique.mockResolvedValue({
      ...shop,
      plan: 'growth',
      planStartedAt: new Date(),
    });
    await service({}).subscribe(7, { plan: 'free' });
    expect(boutique.update.mock.calls[0][0].data).toEqual({
      churnedAt: expect.any(Date),
    });
  });
});
