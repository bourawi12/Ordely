import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface ChargeRequest {
  /** Amount in TND. */
  amount: number;
  description: string;
  /**
   * What the provider's own checkout hands back for a card: a token, never the card number.
   * Ordely's servers never see or store card data.
   */
  token: string;
}

export interface ChargeResult {
  status: 'succeeded' | 'failed';
  /** The provider's id for the charge. */
  reference: string;
  cardBrand?: string;
  cardLast4?: string;
  /** Why it failed, as a short code (e.g. "card_declined"). */
  failureReason?: string;
}

/** A payment gateway. One implementation today (simulated); Konnect or Flouci plug in here. */
export interface PaymentProvider {
  readonly name: string;
  charge(request: ChargeRequest): Promise<ChargeResult>;
}

/**
 * TEST MODE. Moves no money: the outcome depends only on the test token, like a gateway's
 * sandbox. The frontend maps well-known test card numbers to these tokens in the browser.
 */
export const TEST_TOKENS: Record<
  string,
  { ok: boolean; brand: string; last4: string; reason?: string }
> = {
  tok_test_visa: { ok: true, brand: 'Visa', last4: '4242' },
  tok_test_mastercard: { ok: true, brand: 'Mastercard', last4: '4444' },
  tok_test_declined: {
    ok: false,
    brand: 'Visa',
    last4: '0002',
    reason: 'card_declined',
  },
  tok_test_insufficient_funds: {
    ok: false,
    brand: 'Visa',
    last4: '9995',
    reason: 'insufficient_funds',
  },
};

export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = 'simulated';

  charge(request: ChargeRequest): Promise<ChargeResult> {
    const card = TEST_TOKENS[request.token];
    if (!card) {
      throw new BadRequestException('Unknown test card');
    }
    return Promise.resolve({
      status: card.ok ? 'succeeded' : 'failed',
      reference: `sim_${randomUUID()}`,
      cardBrand: card.brand,
      cardLast4: card.last4,
      failureReason: card.reason,
    });
  }
}
