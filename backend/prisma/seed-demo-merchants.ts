/**
 * DEV ONLY. Demo merchants for the back office (/admin): ~45 shops over the last 16 weeks with
 * varied plans, volumes and outcomes — never activated, trial then gone, dormant, steady free,
 * growing paid, high volume, churned, and free shops close to their quota (upsell candidates).
 *
 *   npm run db:seed:demo
 *
 * Re-running replaces the previous demo merchants (accounts ending in @demo.ordely.test) and
 * touches nothing else. Refuses to run in production or against a non-local database.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const DEMO_DOMAIN = 'demo.ordely.test';

function refuseOutsideDev() {
  const env =
    `${process.env.NODE_ENV ?? ''} ${process.env.APP_ENV ?? ''}`.toLowerCase();
  if (env.includes('prod')) {
    throw new Error(
      'Refusing to seed demo merchants: NODE_ENV/APP_ENV says production.',
    );
  }
  const host = /@([^:/?]+)/.exec(process.env.DATABASE_URL ?? '')?.[1] ?? '';
  if (
    !['localhost', '127.0.0.1', 'db', 'postgres'].includes(host) &&
    process.env.ALLOW_DEMO_SEED !== '1'
  ) {
    throw new Error(
      `Refusing to seed demo merchants into the database at "${host}". ` +
        'This script is for local development (set ALLOW_DEMO_SEED=1 to force on a dev server).',
    );
  }
}

// Deterministic PRNG: every run produces the same data set (relative to today).
let state = 20261005;
function rand() {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(items: readonly T[]) =>
  items[Math.floor(rand() * items.length)];
const between = (min: number, max: number) =>
  min + Math.floor(rand() * (max - min + 1));

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TUNIS = HOUR; // UTC+1, no DST

const SHOP_WORDS = [
  'Bazar',
  'Dar',
  'Souk',
  'Maison',
  'Atelier',
  'Studio',
  'Coin',
  'Boutique',
  'Planet',
  'Store',
];
const SHOP_NAMES = [
  'Yasmine',
  'Carthage',
  'Sidi Bou',
  'Medina',
  'Jasmin',
  'Kairouan',
  'Djerba',
  'Hammamet',
  'Tabarka',
  'Byrsa',
  'Zitouna',
  'Nabeul',
  'Sahel',
  'Cap Bon',
  'Elyssa',
  'Douz',
  'Tozeur',
  'Kerkennah',
];
const OWNERS = [
  'Amine',
  'Sarra',
  'Hamza',
  'Ines',
  'Walid',
  'Mariem',
  'Karim',
  'Rim',
  'Youssef',
  'Emna',
  'Bilel',
  'Salma',
  'Mehdi',
  'Asma',
  'Anis',
  'Chaima',
  'Aziz',
  'Nour',
];
const SECTORS = ['fashion', 'cosmetics', 'electronics', 'food', 'other'];
const ITEMS: Record<string, [string, number, number][]> = {
  fashion: [
    ['Robe en lin', 69, 129],
    ['Sac à main', 95, 260],
    ['Baskets', 110, 280],
  ],
  cosmetics: [
    ['Crème hydratante', 29, 65],
    ['Coffret parfum', 85, 220],
    ['Set maquillage', 40, 120],
  ],
  electronics: [
    ['Écouteurs Bluetooth', 45, 149],
    ['Montre connectée', 120, 390],
    ['Chargeur USB-C', 25, 59],
  ],
  food: [
    ["Huile d'olive 1L", 22, 38],
    ['Dattes Deglet Nour', 18, 45],
    ['Harissa artisanale', 9, 19],
  ],
  other: [
    ['Coussin décoratif', 25, 60],
    ['Lampe de bureau', 39, 99],
    ['Jouet en bois', 29, 79],
  ],
};
const LANGUAGES = ['Darija', 'French', 'English'];

type Archetype =
  | 'never'
  | 'trial'
  | 'dormant'
  | 'steady'
  | 'growing'
  | 'power'
  | 'churned'
  | 'upsell';

/** How many merchants of each kind. */
const MIX: [Archetype, number][] = [
  ['never', 6],
  ['trial', 5],
  ['dormant', 5],
  ['steady', 11],
  ['growing', 8],
  ['power', 3],
  ['churned', 4],
  ['upsell', 3],
];

interface Profile {
  kind: Archetype;
  signupAt: number;
  plan: string | null;
  planStartedAt: number | null;
  churnedAt: number | null;
  onboarded: boolean;
  sector: string;
  /** Orders per day at a moment (0 = none). */
  ordersPerDay: (t: number) => number;
  /** Chance that an answered call ends in a confirmation. */
  confirmRate: number;
  /** Chance that a call is answered. */
  answerRate: number;
}

function profile(kind: Archetype, now: number): Profile {
  // Signups spread over the last 16 weeks; some kinds need history.
  const minAge = {
    never: 1,
    trial: 15,
    dormant: 40,
    steady: 20,
    growing: 30,
    power: 60,
    churned: 50,
    upsell: 20,
  }[kind];
  const age = between(minAge, 112);
  const signupAt = now - age * DAY - between(0, 10) * HOUR;
  const live = (t: number) => t >= signupAt + between(0, 2) * DAY;
  const base: Profile = {
    kind,
    signupAt,
    plan: null,
    planStartedAt: null,
    churnedAt: null,
    onboarded: true,
    sector: pick(SECTORS),
    ordersPerDay: () => 0,
    confirmRate: 0.7 + rand() * 0.22,
    answerRate: 0.72 + rand() * 0.2,
  };
  const daysIn = (t: number) => (t - signupAt) / DAY;
  switch (kind) {
    case 'never':
      return { ...base, onboarded: rand() < 0.5 };
    case 'trial': {
      const stop = signupAt + between(4, 9) * DAY;
      return { ...base, ordersPerDay: (t) => (live(t) && t < stop ? 2 : 0) };
    }
    case 'dormant': {
      const stop = now - between(16, 35) * DAY;
      const rateDay = between(3, 8);
      return {
        ...base,
        ordersPerDay: (t) => (live(t) && t < stop ? rateDay : 0),
      };
    }
    case 'steady': {
      const rateDay = between(2, 9);
      return { ...base, ordersPerDay: (t) => (live(t) ? rateDay : 0) };
    }
    case 'growing': {
      const start = between(2, 5);
      return {
        ...base,
        plan: pick(['starter', 'starter', 'growth']),
        planStartedAt: signupAt + between(7, 25) * DAY,
        ordersPerDay: (t) => (live(t) ? start + daysIn(t) * 0.25 : 0),
      };
    }
    case 'power': {
      const rateDay = between(28, 40);
      return {
        ...base,
        plan: pick(['growth', 'pro']),
        planStartedAt: signupAt + between(5, 15) * DAY,
        confirmRate: 0.85 + rand() * 0.08,
        ordersPerDay: (t) => (live(t) ? rateDay : 0),
      };
    }
    case 'churned': {
      const planStartedAt = signupAt + between(7, 20) * DAY;
      const churnedAt = Math.min(
        now - between(3, 25) * DAY,
        planStartedAt + between(25, 60) * DAY,
      );
      const rateDay = between(4, 10);
      return {
        ...base,
        plan: 'starter',
        planStartedAt,
        churnedAt,
        // Weak results, then fading out after cancelling.
        confirmRate: 0.5 + rand() * 0.15,
        ordersPerDay: (t) =>
          !live(t)
            ? 0
            : t < churnedAt
              ? rateDay
              : t < churnedAt + 7 * DAY
                ? 1
                : 0,
      };
    }
    case 'upsell': {
      // Free shops already near their 500 calls this month.
      const monthStart =
        Date.UTC(
          new Date(now).getUTCFullYear(),
          new Date(now).getUTCMonth(),
          1,
        ) - TUNIS;
      const daysThisMonth = Math.max(1, (now - monthStart) / DAY);
      const burst = Math.ceil(430 / daysThisMonth);
      return {
        ...base,
        answerRate: 0.9,
        ordersPerDay: (t) => (!live(t) ? 0 : t >= monthStart ? burst : 8),
      };
    }
  }
}

/** A moment during Tunisian business hours (08:00–22:00) on the day starting at dayStartUtc. */
function businessMoment(dayStartUtc: number) {
  return dayStartUtc - TUNIS + between(8 * 60, 21 * 60 + 59) * MINUTE;
}

async function main() {
  refuseOutsideDev();
  const prisma = new PrismaClient();
  try {
    // Replace the previous demo merchants only.
    const old = await prisma.user.findMany({
      where: { email: { endsWith: `@${DEMO_DOMAIN}` } },
      select: { id: true, boutiqueId: true },
    });
    await prisma.user.deleteMany({
      where: { id: { in: old.map((u) => u.id) } },
    });
    // Orders and calls go with their shop (ON DELETE CASCADE).
    await prisma.boutique.deleteMany({
      where: { id: { in: old.map((u) => u.boutiqueId) } },
    });

    const now = Date.now();
    const today = Math.floor((now + TUNIS) / DAY) * DAY;
    // One unusable password for every demo account: these are not meant to log in.
    const passwordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
    const kinds = MIX.flatMap(([kind, n]) => Array<Archetype>(n).fill(kind));
    let totals = { orders: 0, calls: 0 };

    for (const [i, kind] of kinds.entries()) {
      const p = profile(kind, now);
      const owner = pick(OWNERS);
      const shop = await prisma.boutique.create({
        data: {
          name: `${pick(SHOP_WORDS)} ${pick(SHOP_NAMES)} ${i + 1}`,
          businessPhone: `+216 7${between(0, 9)} ${between(100, 999)} ${between(100, 999)}`,
          platform: pick(['shopify', 'woocommerce', 'social_shop', 'custom']),
          callLanguages:
            rand() < 0.7 ? ['darija', 'french'] : ['french', 'english'],
          callStartTime: '09:00',
          callEndTime: '20:00',
          sector: p.sector,
          dailyOrderVolume: pick(['lt20', '20_50', '50_100']),
          acquisitionSource: pick([
            'facebook',
            'instagram',
            'tiktok',
            'google',
            'referral',
          ]),
          onboardingCompletedAt: p.onboarded
            ? new Date(p.signupAt + between(10, 180) * MINUTE)
            : null,
          plan: p.plan,
          planStartedAt: p.planStartedAt ? new Date(p.planStartedAt) : null,
          churnedAt: p.churnedAt ? new Date(p.churnedAt) : null,
          createdAt: new Date(p.signupAt),
          users: {
            create: {
              email: `merchant${i + 1}@${DEMO_DOMAIN}`,
              name: `${owner} ${pick(['Ben Ali', 'Trabelsi', 'Gharbi', 'Jebali', 'Mansour', 'Kammoun'])}`,
              passwordHash,
              emailVerifiedAt: new Date(p.signupAt + 5 * MINUTE),
              createdAt: new Date(p.signupAt),
            },
          },
        },
      });

      // Orders, day by day since signup.
      const orders: Prisma.OrderCreateManyInput[] = [];
      // One product line per order, inserted once the orders have ids.
      const lines: {
        productName: string;
        quantity: number;
        unitPrice: number;
      }[] = [];
      for (
        let day = Math.floor((p.signupAt + TUNIS) / DAY) * DAY;
        day <= today;
        day += DAY
      ) {
        const expected = p.ordersPerDay(day + 12 * HOUR);
        // Weekends a bit busier, every day a bit noisy.
        const weekend = [0, 6].includes(new Date(day).getUTCDay()) ? 1.2 : 1;
        const count = Math.round(expected * weekend * (0.7 + rand() * 0.6));
        for (let k = 0; k < count; k++) {
          const at = businessMoment(day);
          if (at < p.signupAt || at > now - 20 * MINUTE) continue;
          const [item, min, max] = pick(ITEMS[p.sector]);
          const quantity = rand() < 0.85 ? 1 : 2;
          const unitPrice = between(min, max);
          lines.push({ productName: item, quantity, unitPrice });
          orders.push({
            boutiqueId: shop.id,
            customer: `Client ${between(1000, 9999)}`,
            phone: `+216 ${pick(['2', '5', '9'])}${between(0, 9)} ${between(100, 999)} ${between(100, 999)}`,
            total: unitPrice * quantity,
            status: 'pending',
            createdAt: new Date(at),
          });
        }
      }

      // Calls: up to 3 attempts per order, outcome driven by the shop's profile and the hour.
      const calls: Omit<Prisma.CallCreateManyInput, 'orderId'>[][] = [];
      for (const order of orders) {
        const list: Omit<Prisma.CallCreateManyInput, 'orderId'>[] = [];
        let at = (order.createdAt as Date).getTime() + between(2, 15) * MINUTE;
        for (let attempt = 1; attempt <= 3 && at < now; attempt++) {
          const hour = new Date(at + TUNIS).getUTCHours();
          const lunch = hour >= 12 && hour < 15 ? 0.82 : hour >= 18 ? 1.05 : 1;
          const language = pick(LANGUAGES);
          if (rand() > p.answerRate * lunch) {
            list.push({
              attempt,
              status: 'no_answer',
              createdAt: new Date(at),
            });
            at += between(1, 3) * HOUR;
            continue;
          }
          const yes =
            rand() < p.confirmRate + (language === 'Darija' ? 0.03 : 0);
          list.push({
            attempt,
            status: yes ? 'confirmed' : 'failed',
            durationSeconds: yes ? between(45, 130) : between(20, 70),
            language,
            createdAt: new Date(at),
          });
          order.status = yes ? 'confirmed' : 'cancelled';
          break;
        }
        calls.push(list);
      }

      for (let start = 0; start < orders.length; start += 1000) {
        const batch = orders.slice(start, start + 1000);
        const created = await prisma.order.createManyAndReturn({
          data: batch,
          select: { id: true },
        });
        await prisma.orderItem.createMany({
          data: created.map((o, j) => ({ ...lines[start + j], orderId: o.id })),
        });
        const rows = created.flatMap((o, j) =>
          calls[start + j].map((c) => ({ ...c, orderId: o.id })),
        );
        if (rows.length) await prisma.call.createMany({ data: rows });
        totals = {
          orders: totals.orders + batch.length,
          calls: totals.calls + rows.length,
        };
      }
    }
    console.log(
      `Seeded ${kinds.length} demo merchants (@${DEMO_DOMAIN}) with ${totals.orders} orders and ${totals.calls} calls.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
