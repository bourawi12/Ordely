import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Boutique } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BoutiqueService, nextOnboardingStep } from './boutique.service';

const empty: Boutique = {
  id: 7,
  name: null,
  businessPhone: null,
  platform: null,
  callLanguages: [],
  callStartTime: null,
  callEndTime: null,
  confirmationProcess: null,
  sector: null,
  deliveryZones: [],
  dailyOrderVolume: null,
  acquisitionSource: null,
  carrier: null,
  onboardingCompletedAt: null,
  plan: null,
  planStartedAt: null,
  churnedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const identityDone = {
  ...empty,
  name: 'Salma Style',
  businessPhone: '+216 22 000 000',
  platform: 'shopify',
};
const requiredDone = {
  ...identityDone,
  callLanguages: ['darija'],
  callStartTime: '09:00',
  callEndTime: '20:00',
};

describe('nextOnboardingStep', () => {
  it('returns the first required screen still missing, then the optional one', () => {
    expect(nextOnboardingStep(empty)).toBe(1);
    expect(nextOnboardingStep({ ...identityDone, platform: null })).toBe(1);
    expect(nextOnboardingStep(identityDone)).toBe(2);
    expect(nextOnboardingStep({ ...requiredDone, callLanguages: [] })).toBe(2);
    // Business details are optional: they never hold the merchant back.
    expect(nextOnboardingStep(requiredDone)).toBe(3);
  });
});

describe('BoutiqueService', () => {
  let service: BoutiqueService;
  const user = { findUnique: jest.fn() };
  const boutique = { update: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    boutique.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...requiredDone, ...data }),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        BoutiqueService,
        { provide: PrismaService, useValue: { user, boutique } },
      ],
    }).compile();
    service = moduleRef.get(BoutiqueService);
  });

  it('refuses a calling window shorter than one hour or ending before it starts', async () => {
    user.findUnique.mockResolvedValue({ boutique: identityDone });
    for (const [start, end] of [
      ['09:00', '09:30'],
      ['20:00', '09:00'],
    ]) {
      await expect(
        service.updateAgent(1, {
          callLanguages: ['darija'],
          callStartTime: start,
          callEndTime: end,
        }),
      ).rejects.toThrow(BadRequestException);
    }
    expect(boutique.update).not.toHaveBeenCalled();
  });

  it('keeps only "all" when the whole country is picked', async () => {
    user.findUnique.mockResolvedValue({ boutique: requiredDone });
    await service.updateDetails(1, { deliveryZones: ['tunis', 'all'] });
    expect(boutique.update.mock.calls[0][0].data.deliveryZones).toEqual([
      'all',
    ]);
  });

  it('refuses to complete the onboarding while a required screen is missing', async () => {
    user.findUnique.mockResolvedValue({ boutique: identityDone });
    await expect(service.completeOnboarding(1)).rejects.toThrow(
      ConflictException,
    );
    expect(boutique.update).not.toHaveBeenCalled();
  });

  it('completes the onboarding once the two required screens are filled', async () => {
    user.findUnique.mockResolvedValue({ boutique: requiredDone });
    const result = await service.completeOnboarding(1);
    expect(
      boutique.update.mock.calls[0][0].data.onboardingCompletedAt,
    ).toBeInstanceOf(Date);
    expect(result.onboarding.completed).toBe(true);
  });
});
