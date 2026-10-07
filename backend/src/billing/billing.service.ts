import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { planOf, PLANS } from '../admin/plans';
import { PrismaService } from '../prisma/prisma.service';
import { currentPlan, recommendedPlan } from './billing.rules';
import { SubscribeDto } from './dto/subscribe.dto';
import { PaymentProvider, SimulatedPaymentProvider } from './payment-provider';

const FAILURE_MESSAGES: Record<string, string> = {
  card_declined: 'Your card was declined.',
  insufficient_funds: 'Your card has insufficient funds.',
};

/**
 * A shop's plan: which one fits, which one it is on, and paying for a paid one. Every payment
 * attempt is recorded; the plan only changes after a successful charge, in the same transaction.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly provider: PaymentProvider | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.provider = this.resolveProvider();
  }

  /**
   * PAYMENTS_PROVIDER picks the gateway. "simulated" is test mode and never runs in
   * production: there it would hand out paid plans for free.
   */
  private resolveProvider(): PaymentProvider | null {
    const name = (this.config.get<string>('PAYMENTS_PROVIDER') ?? '').trim();
    if (!name) return null;
    if (name === 'simulated') {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        this.logger.error(
          'PAYMENTS_PROVIDER=simulated is refused in production: paid plans stay unavailable.',
        );
        return null;
      }
      this.logger.warn(
        'Payments run in TEST MODE (simulated): no money moves.',
      );
      return new SimulatedPaymentProvider();
    }
    this.logger.error(
      `Unknown PAYMENTS_PROVIDER "${name}": paid plans are unavailable.`,
    );
    return null;
  }

  private async shop(boutiqueId: number) {
    const shop = await this.prisma.boutique.findUnique({
      where: { id: boutiqueId },
    });
    if (!shop) throw new UnauthorizedException();
    return shop;
  }

  /** The catalogue, the plan that fits the shop's declared volume, and its current plan. */
  async plans(boutiqueId: number) {
    const shop = await this.shop(boutiqueId);
    return {
      plans: PLANS,
      recommended: recommendedPlan(shop.dailyOrderVolume).code,
      current: currentPlan(shop).code,
      currency: 'TND',
      payments: {
        /** False: paid plans can't be bought here yet. */
        available: this.provider !== null,
        testMode: this.provider?.name === 'simulated',
      },
    };
  }

  /** Free: no payment. Paid: one month is charged first; a failed charge changes nothing. */
  async subscribe(boutiqueId: number, dto: SubscribeDto) {
    const shop = await this.shop(boutiqueId);
    const plan = planOf(dto.plan);

    if (plan.price === 0) {
      // Leaving a running paid plan is a cancellation; the plan code stays for the history.
      if (currentPlan(shop).price > 0) {
        await this.prisma.boutique.update({
          where: { id: boutiqueId },
          data: { churnedAt: new Date() },
        });
      }
      return { plan: plan.code, payment: null };
    }

    if (!this.provider) {
      throw new ServiceUnavailableException(
        'Online payment is not available yet. Choose the free plan for now.',
      );
    }
    if (!dto.paymentToken) {
      throw new BadRequestException(
        'A payment method is required for this plan',
      );
    }

    const charge = await this.provider.charge({
      amount: plan.price,
      description: `Ordely ${plan.label} — 1 month — shop #${boutiqueId}`,
      token: dto.paymentToken,
    });
    const record = {
      boutiqueId,
      plan: plan.code,
      amount: plan.price,
      provider: this.provider.name,
      status: charge.status,
      reference: charge.reference,
      cardBrand: charge.cardBrand,
      cardLast4: charge.cardLast4,
      failureReason: charge.failureReason,
    };

    if (charge.status !== 'succeeded') {
      await this.prisma.payment.create({ data: record });
      throw new HttpException(
        FAILURE_MESSAGES[charge.failureReason ?? ''] ??
          'The payment was refused.',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const [payment] = await this.prisma.$transaction([
      this.prisma.payment.create({ data: record }),
      this.prisma.boutique.update({
        where: { id: boutiqueId },
        data: { plan: plan.code, planStartedAt: new Date(), churnedAt: null },
      }),
    ]);
    this.logger.log(
      `Shop ${boutiqueId} subscribed to ${plan.code} (${charge.reference})`,
    );
    return {
      plan: plan.code,
      payment: {
        id: payment.id,
        amount: plan.price,
        currency: 'TND',
        reference: payment.reference,
        cardBrand: payment.cardBrand,
        cardLast4: payment.cardLast4,
        testMode: this.provider.name === 'simulated',
      },
    };
  }
}
