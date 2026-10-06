/**
 * Demo data: ~180 days of orders and confirmation calls, with realistic patterns for analytics:
 * customers answer best in the evening and worst at lunch, pricier items get cancelled more,
 * calls in Darija confirm best, and weekends bring more orders.
 *
 * The orders go to one shop: the one of the account given with --email, else the oldest shop.
 *
 *   npm run db:seed                            # only if that shop has no orders yet
 *   npm run db:seed -- --email you@example.com # seed that account's shop
 *   npm run db:seed -- --reset                 # deletes that shop's orders and calls first
 *   npm run db:seed -- --append                # adds the demo data next to the existing orders
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Deterministic PRNG so every seed produces the same data set.
let state = 20260922;
function rand() {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const FIRST_NAMES = [
  'Rania', 'Sami', 'Nour', 'Amine', 'Leila', 'Hamza', 'Fatma', 'Omar', 'Malek', 'Yasmine',
  'Hana', 'Bilel', 'Sara', 'Aziz', 'Ines', 'Youssef', 'Mariem', 'Karim', 'Salma', 'Mehdi',
  'Asma', 'Walid', 'Emna', 'Anis', 'Rim', 'Khalil', 'Sirine', 'Hatem', 'Chaima', 'Ahmed',
];
const LAST_NAMES = [
  'Gharbi', 'Khelifi', 'Ben Salem', 'Toumi', 'Mansour', 'Riahi', 'Chaari', 'Ayedi', 'Boujemaa',
  'Slama', 'Jebali', 'Zouari', 'Dridi', 'Trabelsi', 'Bouzid', 'Hammami', 'Jlassi', 'Ferchichi',
  'Mejri', 'Sassi', 'Baccar', 'Kammoun', 'Mabrouk', 'Hadded',
];
const PRODUCTS: [string, number, number][] = [
  ["Robe d'été en lin", 69, 129],
  ['Écouteurs Bluetooth', 45, 149],
  ['Crème hydratante bio', 29, 65],
  ['Montre connectée', 120, 390],
  ['Sac à main en cuir', 95, 260],
  ['Baskets de running', 110, 280],
  ['Coffret parfum', 85, 220],
  ['Chargeur rapide USB-C', 25, 59],
  ['Set de maquillage', 40, 120],
  ["Huile d'olive extra vierge 1L", 22, 38],
  ['Coussin décoratif', 25, 60],
  ['Clavier mécanique', 140, 320],
  ['Lunettes de soleil', 55, 180],
  ['Babyliss lisseur', 90, 210],
];
const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TUNIS_OFFSET = HOUR; // UTC+1, no DST

type Line = { speaker: 'agent' | 'customer'; text: string };

function phone() {
  return `+216 ${pick(['2', '5', '9', '4'])}${between(0, 9)} ${between(100, 999)} ${between(100, 999)}`;
}

function transcript(
  outcome: 'confirmed' | 'failed',
  language: string,
  first: string,
  total: number,
  delivery: Date,
): Line[] {
  const amount = total.toFixed(0);
  if (language === 'Darija') {
    const day = DAYS_AR[delivery.getUTCDay()];
    return [
      { speaker: 'agent', text: `عسلامة ${first}، نحبّو نأكدو معاك الكوموند متاعك ب ${amount} دينار… التوصيل نهار ${day}. تأكد؟` },
      outcome === 'confirmed'
        ? { speaker: 'customer', text: 'إيه، صحيح. يعيشك.' }
        : { speaker: 'customer', text: 'لا، ما عادش نحب عليها.' },
    ];
  }
  if (language === 'English') {
    return [
      { speaker: 'agent', text: `Hello ${first}, we're confirming your order of ${amount} TND… Delivery is planned for ${delivery.toLocaleDateString('en-GB', { weekday: 'long' })}. Can you confirm?` },
      outcome === 'confirmed'
        ? { speaker: 'customer', text: "Yes, that's right." }
        : { speaker: 'customer', text: "No, I'd like to cancel it." },
    ];
  }
  const day = DAYS_FR[delivery.getUTCDay()];
  return [
    { speaker: 'agent', text: `Bonjour ${first}, nous confirmons votre commande de ${amount} TND… Livraison prévue ${day}. Est-ce que vous confirmez ?` },
    outcome === 'confirmed'
      ? { speaker: 'customer', text: "Oui, c'est correct." }
      : { speaker: 'customer', text: "Non, je souhaite l'annuler." },
  ];
}

/** Random moment during Tunisian business hours (08:00–22:00) on the given day. */
function orderTime(dayStartUtc: number, now: number) {
  const localStart = dayStartUtc - TUNIS_OFFSET;
  const t = localStart + between(8 * 60, 22 * 60) * MINUTE;
  return t < now ? t : null;
}

/**
 * One call's outcome. Customers answer best in the evening and worst at lunch; once they answer,
 * pricier items are cancelled more and calls in Darija confirm best. A few calls stay queued.
 */
function callOutcome(callAt: number, price: number, language: string) {
  if (rand() < 0.03) return 'pending';
  const hour = new Date(callAt + TUNIS_OFFSET).getUTCHours();
  const answer = hour >= 18 ? 0.93 : hour >= 12 && hour < 15 ? 0.68 : hour < 10 ? 0.76 : 0.86;
  if (rand() >= answer) return 'no_answer';
  const confirm =
    0.9 - (price > 150 ? 0.14 : price > 80 ? 0.05 : 0) + (language === 'Darija' ? 0.05 : language === 'English' ? -0.06 : 0);
  return rand() < confirm ? 'confirmed' : 'failed';
}

/** The shop to seed: the given account's, else the oldest one (created empty if there is none). */
async function targetBoutique(email?: string): Promise<number | null> {
  if (email) {
    const user = await prisma.user.findUnique({ where: { email }, select: { boutiqueId: true } });
    if (!user) {
      console.error(`No account with the e-mail address ${email}.`);
      process.exitCode = 1;
      return null;
    }
    return user.boutiqueId;
  }
  const oldest = await prisma.boutique.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
  return oldest?.id ?? (await prisma.boutique.create({ data: { name: 'Demo' } })).id;
}

async function main() {
  const reset = process.argv.includes('--reset');
  const append = process.argv.includes('--append');
  const emailArg = process.argv.indexOf('--email');
  const email = emailArg === -1 ? undefined : process.argv[emailArg + 1];
  const boutiqueId = await targetBoutique(email);
  if (boutiqueId === null) return;

  const existing = await prisma.order.count({ where: { boutiqueId } });
  if (existing > 0 && !reset && !append) {
    console.log(
      `Shop ${boutiqueId} already has ${existing} orders. Re-run with --reset to replace them, or --append to keep them.`,
    );
    return;
  }

  // Calls go with their orders (ON DELETE CASCADE).
  if (!append) await prisma.order.deleteMany({ where: { boutiqueId } });
  if ((await prisma.order.count()) === 0) {
    // Order numbers look like #10480 rather than #1.
    await prisma.$executeRaw`ALTER SEQUENCE "orders_id_seq" RESTART WITH 10480`;
  }

  const now = Date.now();
  const todayUtcMidnight = Math.floor((now + TUNIS_OFFSET) / DAY) * DAY;

  const orders: Prisma.OrderCreateInput[] = [];
  const addOrder = (createdAt: number, recent: boolean) => {
    const first = pick(FIRST_NAMES);
    const [item, min, max] = pick(PRODUCTS);
    const quantity = rand() < 0.8 ? 1 : between(2, 3);
    const unitPrice = between(min, max);
    const total = unitPrice * quantity + (rand() < 0.3 ? 0.5 : 0);
    const order: Prisma.OrderCreateInput = {
      customer: `${first} ${pick(LAST_NAMES)}`,
      phone: phone(),
      total,
      status: 'pending',
      createdAt: new Date(createdAt),
      boutique: { connect: { id: boutiqueId } },
      items: {
        create: [
          {
            productName: item,
            quantity,
            unitPrice,
          },
        ],
      },
    };
    const calls: Prisma.CallCreateWithoutOrderInput[] = [];

    if (!recent) {
      let callAt = createdAt + between(2, 12) * MINUTE;
      for (let attempt = 1; attempt <= 3 && callAt < now; attempt++) {
        const language = rand() < 0.55 ? 'Darija' : rand() < 0.78 ? 'French' : 'English';
        const outcome = callOutcome(callAt, (min + max) / 2, language);
        const delivery = new Date(callAt + between(1, 3) * DAY);

        if (outcome === 'pending') {
          calls.push({ attempt, status: 'pending', createdAt: new Date(callAt) });
          break;
        }
        calls.push({
          attempt,
          status: outcome,
          createdAt: new Date(callAt),
          durationSeconds:
            outcome === 'confirmed' ? between(45, 130) : outcome === 'failed' ? between(20, 60) : null,
          language: outcome === 'no_answer' ? null : language,
          transcript:
            outcome === 'no_answer'
              ? Prisma.JsonNull
              : (transcript(outcome, language, first, total, delivery) as Prisma.InputJsonValue),
        });
        if (outcome === 'confirmed') {
          order.status = 'confirmed';
          break;
        }
        if (outcome === 'failed') {
          order.status = 'cancelled';
          break;
        }
        callAt += between(1, 3) * HOUR; // retry after no answer
      }
    }
    order.calls = { create: calls };
    orders.push(order);
  };

  // 180 days of history, busier recently so every period comparison shows growth.
  for (let d = 179; d >= 1; d--) {
    const dayStart = todayUtcMidnight - d * DAY;
    const weekend = [0, 6].includes(new Date(dayStart).getUTCDay());
    const perDay = (d > 90 ? between(2, 4) : d > 30 ? between(3, 6) : between(4, 8)) + (weekend ? between(1, 3) : 0);
    for (let i = 0; i < perDay; i++) {
      const t = orderTime(dayStart, now);
      if (t) addOrder(t, false);
    }
  }
  // Today: a steady stream of processed orders…
  for (let i = 0; i < 9; i++) {
    const t = orderTime(todayUtcMidnight, now - 30 * MINUTE);
    if (t) addOrder(t, false);
  }
  // …and a few that just came in and still await a call.
  for (const minutesAgo of [11, 8, 5]) {
    addOrder(now - minutesAgo * MINUTE, true);
  }

  orders.sort((a, b) => +new Date(a.createdAt as Date) - +new Date(b.createdAt as Date));
  for (const data of orders) {
    await prisma.order.create({ data });
  }

  const [orderCount, callCount] = await Promise.all([
    prisma.order.count({ where: { boutiqueId } }),
    prisma.call.count({ where: { order: { boutiqueId } } }),
  ]);
  console.log(`Seeded ${orderCount} orders and ${callCount} calls into shop ${boutiqueId}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
