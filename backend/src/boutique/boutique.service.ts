import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Boutique, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ALL_ZONES, MIN_CALL_WINDOW_MINUTES } from './boutique-options';
import { AgentDto } from './dto/agent.dto';
import { DetailsDto } from './dto/details.dto';
import { IdentityDto } from './dto/identity.dto';

/**
 * Onboarding screens: 1 identity and 2 agent are required (they block the first call);
 * 3 details is optional. nextStep is the first required screen still missing, else 3.
 */
export type OnboardingStep = 1 | 2 | 3;

export interface BoutiqueView extends Boutique {
  onboarding: { completed: boolean; nextStep: OnboardingStep };
}

export function nextOnboardingStep(b: Boutique): OnboardingStep {
  if (!b.name || !b.businessPhone || !b.platform) return 1;
  if (!b.callLanguages.length || !b.callStartTime || !b.callEndTime) return 2;
  return 3;
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

@Injectable()
export class BoutiqueService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: number): Promise<BoutiqueView> {
    return this.view(await this.load(userId));
  }

  updateIdentity(userId: number, dto: IdentityDto) {
    return this.update(userId, dto);
  }

  async updateAgent(userId: number, dto: AgentDto) {
    const window = minutes(dto.callEndTime) - minutes(dto.callStartTime);
    if (window < MIN_CALL_WINDOW_MINUTES) {
      throw new BadRequestException(
        "La plage d'appel doit durer au moins une heure, et finir après son début.",
      );
    }
    return this.update(userId, {
      callLanguages: dto.callLanguages,
      callStartTime: dto.callStartTime,
      callEndTime: dto.callEndTime,
      confirmationProcess: dto.confirmationProcess ?? null,
    });
  }

  updateDetails(userId: number, dto: DetailsDto) {
    const zones = dto.deliveryZones ?? [];
    // "Whole country" replaces any individual gouvernorat.
    const deliveryZones = zones.includes(ALL_ZONES) ? [ALL_ZONES] : zones;
    return this.update(userId, {
      sector: dto.sector ?? null,
      deliveryZones,
      dailyOrderVolume: dto.dailyOrderVolume ?? null,
      acquisitionSource: dto.acquisitionSource ?? null,
      carrier: dto.carrier ?? null,
    });
  }

  /** Marks the onboarding done; refused while a required screen is missing. */
  async completeOnboarding(userId: number): Promise<BoutiqueView> {
    const boutique = await this.load(userId);
    if (nextOnboardingStep(boutique) < 3) {
      throw new ConflictException(
        "Terminez d'abord les étapes obligatoires de l'onboarding.",
      );
    }
    if (boutique.onboardingCompletedAt) return this.view(boutique);
    return this.view(
      await this.prisma.boutique.update({
        where: { id: boutique.id },
        data: { onboardingCompletedAt: new Date() },
      }),
    );
  }

  private async update(
    userId: number,
    data: Prisma.BoutiqueUpdateInput,
  ): Promise<BoutiqueView> {
    const { id } = await this.load(userId);
    return this.view(
      await this.prisma.boutique.update({ where: { id }, data }),
    );
  }

  private async load(userId: number): Promise<Boutique> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { boutique: true },
    });
    if (!user) throw new UnauthorizedException();
    return user.boutique;
  }

  private view(boutique: Boutique): BoutiqueView {
    return {
      ...boutique,
      onboarding: {
        completed: boutique.onboardingCompletedAt !== null,
        nextStep: nextOnboardingStep(boutique),
      },
    };
  }
}
