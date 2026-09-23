/**
 * Demo data: ~60 days of orders and confirmation calls.
 *
 *   npm run db:seed            # only if there are no orders yet
 *   npm run db:seed -- --reset # deletes ALL orders and calls first (users are kept)
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
  if (language === 'Arabic') {
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

async function main() {
  const reset = process.argv.includes('--reset');
  const existing = await prisma.order.count();
  if (existing > 0 && !reset) {
    console.log(`Database already has ${existing} orders. Re-run with --reset to replace them.`);
    return;
  }

  await prisma.$executeRaw`TRUNCATE "calls", "orders" RESTART IDENTITY`;
  // Order numbers look like #10480 rather than #1.
  await prisma.$executeRaw`ALTER SEQUENCE "orders_id_seq" RESTART WITH 10480`;

  const now = Date.now();
  const todayUtcMidnight = Math.floor((now + TUNIS_OFFSET) / DAY) * DAY;

  const orders: Prisma.OrderCreateInput[] = [];
  const addOrder = (createdAt: number, recent: boolean) => {
    const first = pick(FIRST_NAMES);
    const [item, min, max] = pick(PRODUCTS);
    const quantity = rand() < 0.8 ? 1 : between(2, 3);
    const total = between(min, max) * quantity + (rand() < 0.3 ? 0.5 : 0);
    const order: Prisma.OrderCreateInput = {
      customer: `${first} ${pick(LAST_NAMES)}`,
      phone: phone(),
      item,
      quantity,
      total,
      status: 'pending',
      createdAt: new Date(createdAt),
    };
    const calls: Prisma.CallCreateWithoutOrderInput[] = [];

    if (!recent) {
      let callAt = createdAt + between(2, 12) * MINUTE;
      for (let attempt = 1; attempt <= 3 && callAt < now; attempt++) {
        const r = rand();
        const outcome =
          r < 0.82 ? 'confirmed' : r < 0.9 ? 'no_answer' : r < 0.97 ? 'failed' : 'pending';
        const language = rand() < 0.6 ? 'French' : rand() < 0.9 ? 'Arabic' : 'English';
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

  // 60 days of history, busier recently so the 30-day comparison shows growth.
  for (let d = 59; d >= 1; d--) {
    const perDay = d > 30 ? between(3, 5) : between(4, 7);
    for (let i = 0; i < perDay; i++) {
      const t = orderTime(todayUtcMidnight - d * DAY, now);
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

  const [orderCount, callCount] = await Promise.all([prisma.order.count(), prisma.call.count()]);
  console.log(`Seeded ${orderCount} orders and ${callCount} calls.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
