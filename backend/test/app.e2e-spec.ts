import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { MailMessage, MailService } from './../src/mail/mail.service';
import { PrismaService } from './../src/prisma/prisma.service';

// Runs against the database in DATABASE_URL (e.g. `docker compose up -d db`).
describe('App (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  const email = `e2e-${Date.now()}@example.com`;
  // A second merchant, to prove one shop never reaches another's orders.
  const otherEmail = `e2e-other-${Date.now()}@example.com`;
  const resetEmail = `e2e-reset-${Date.now()}@example.com`;
  // Back office: an Ordely admin, and a merchant whose numbers are known.
  const adminEmail = `e2e-admin-${Date.now()}@example.com`;
  const metricsEmail = `e2e-metrics-${Date.now()}@example.com`;
  // Meets the password rule (upper, lower, digit, special character).
  const PASSWORD = 'Passw0rd!e2e';
  // Emails are kept here instead of going out over SMTP.
  const sentMail: MailMessage[] = [];
  const lastLinkToken = (to: string) => {
    const mail = sentMail.filter((m) => m.to === to).pop();
    return /verify-email\?token=([\w-]+)/.exec(mail?.text ?? '')?.[1] ?? '';
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue({ send: async (m: MailMessage) => void sentMail.push(m) })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    const emails = {
      email: { in: [email, otherEmail, resetEmail, adminEmail, metricsEmail] },
    };
    const users = await prisma.user.findMany({ where: emails });
    await prisma.user.deleteMany({ where: emails });
    await prisma.boutique.deleteMany({
      where: { id: { in: users.map((u) => u.boutiqueId) } },
    });
    await app.close();
  });

  it('/health (GET) is public and reports the database as up', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          status: 'ok',
          database: 'up',
          storage: 'up',
        });
      });
  });

  describe('auth', () => {
    it('blocks protected routes without a token', async () => {
      await request(app.getHttpServer()).get('/orders').expect(401);
      await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });

    it('registers, rejects duplicates, and logs in', async () => {
      const server = app.getHttpServer();
      const registered = await request(server)
        .post('/auth/register')
        .send({
          email: email.toUpperCase(),
          name: 'E2E User',
          password: PASSWORD,
        })
        .expect(201);
      expect(registered.body.user).toMatchObject({ email, name: 'E2E User' });
      expect(registered.body.user).not.toHaveProperty('passwordHash');

      await request(server)
        .post('/auth/register')
        .send({ email, name: 'Again', password: PASSWORD })
        .expect(409);

      await request(server)
        .post('/auth/login')
        .send({ email, password: 'wrong-password' })
        .expect(401);

      const login = await request(server)
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      token = login.body.accessToken;

      await request(server)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => expect(res.body.email).toBe(email));
    });

    it('keeps a new account closed until the emailed link is used', async () => {
      const server = app.getHttpServer();
      const auth = { Authorization: `Bearer ${token}` };

      // Signed in, but only the verification routes answer.
      await request(server)
        .get('/auth/me')
        .set(auth)
        .expect(200)
        .expect((res) => expect(res.body.emailVerifiedAt).toBeNull());
      await request(server)
        .get('/boutique')
        .set(auth)
        .expect(403)
        .expect((res) =>
          expect(res.body.message).toBe('Email address not verified'),
        );
      // The sign-up email was sent seconds ago.
      await request(server)
        .post('/auth/resend-verification')
        .set(auth)
        .expect(429);

      const linkToken = lastLinkToken(email);
      await request(server)
        .post('/auth/verify-email')
        .send({ token: 'not-a-real-token' })
        .expect(400);
      await request(server)
        .post('/auth/verify-email')
        .send({ token: linkToken })
        .expect(200)
        .expect((res) => expect(res.body).toEqual({ email }));

      await request(server).get('/boutique').set(auth).expect(200);
      // One use only.
      await request(server)
        .post('/auth/verify-email')
        .send({ token: linkToken })
        .expect(400);
    });

    it('stores the look chosen at sign-up and refuses a bad colour', async () => {
      const server = app.getHttpServer();
      const themed = `themed-${email}`;
      await request(server)
        .post('/auth/register')
        .send({
          email: themed,
          name: 'Themed',
          password: PASSWORD,
          accentColor: 'purple',
        })
        .expect(400);
      const res = await request(server)
        .post('/auth/register')
        .send({
          email: themed,
          name: 'Themed',
          password: PASSWORD,
          accentColor: '#7C3AED',
          themeMode: 'dark',
        })
        .expect(201);
      expect(res.body.user).toMatchObject({
        accentColor: '#7c3aed',
        themeMode: 'dark',
      });

      const created = await prisma.user.findUniqueOrThrow({
        where: { email: themed },
      });
      await prisma.user.delete({ where: { id: created.id } });
      await prisma.boutique.delete({ where: { id: created.boutiqueId } });
    });

    it('rejects weak registrations', async () => {
      const server = app.getHttpServer();
      await request(server)
        .post('/auth/register')
        .send({ email: 'not-an-email', name: '', password: 'short' })
        .expect(400);
      // Long enough, but no uppercase letter and no special character.
      const weak = await request(server)
        .post('/auth/register')
        .send({ email: `weak-${email}`, name: 'Weak', password: 'password123' })
        .expect(400);
      expect(weak.body.message).toContain(
        'password must contain an uppercase letter, a lowercase letter, a number and a special character',
      );
    });

    it('changes the password only to a strong one, then logs in with it', async () => {
      const server = app.getHttpServer();
      const auth = { Authorization: `Bearer ${token}` };
      await request(server)
        .patch('/auth/change-password')
        .set(auth)
        .send({ currentPassword: PASSWORD, newPassword: 'alllowercase1!' })
        .expect(400);

      const strong = 'N3w-Passw0rd!';
      await request(server)
        .patch('/auth/change-password')
        .set(auth)
        .send({ currentPassword: PASSWORD, newPassword: strong })
        .expect(200);
      await request(server)
        .post('/auth/login')
        .send({ email, password: strong })
        .expect(200);

      // Back to the shared password for the tests that follow.
      await request(server)
        .patch('/auth/change-password')
        .set(auth)
        .send({ currentPassword: strong, newPassword: PASSWORD })
        .expect(200);
    });
  });

  describe('boutique onboarding', () => {
    const auth = () => ({ Authorization: `Bearer ${token}` });

    it('requires identity and agent only, then completes with optional details', async () => {
      const server = app.getHttpServer();
      await request(server)
        .get('/boutique')
        .set(auth())
        .expect(200)
        .expect((res) =>
          expect(res.body.onboarding).toEqual({
            completed: false,
            nextStep: 1,
          }),
        );

      // Completing before the required screens is refused.
      await request(server)
        .post('/boutique/onboarding/complete')
        .set(auth())
        .expect(409);

      await request(server)
        .patch('/boutique/identity')
        .set(auth())
        .send({
          name: 'Boutique E2E',
          businessPhone: 'abc',
          platform: 'shopify',
        })
        .expect(400);
      await request(server)
        .patch('/boutique/identity')
        .set(auth())
        .send({
          name: 'Boutique E2E',
          businessPhone: '+216 22 000 000',
          platform: 'shopify',
        })
        .expect(200)
        .expect((res) => expect(res.body.onboarding.nextStep).toBe(2));

      await request(server)
        .patch('/boutique/agent')
        .set(auth())
        .send({
          callLanguages: ['darija'],
          callStartTime: '10:00',
          callEndTime: '10:30',
        })
        .expect(400);
      await request(server)
        .patch('/boutique/agent')
        .set(auth())
        .send({
          callLanguages: ['darija', 'french'],
          callStartTime: '09:00',
          callEndTime: '20:00',
        })
        .expect(200)
        .expect((res) => expect(res.body.onboarding.nextStep).toBe(3));

      await request(server)
        .patch('/boutique/details')
        .set(auth())
        .send({
          sector: 'fashion',
          deliveryZones: ['tunis', 'sfax'],
          carrier: 'aramex',
        })
        .expect(200);

      await request(server)
        .post('/boutique/onboarding/complete')
        .set(auth())
        .expect(200)
        .expect((res) => {
          expect(res.body.onboarding.completed).toBe(true);
          expect(res.body).toMatchObject({
            name: 'Boutique E2E',
            callLanguages: ['darija', 'french'],
            deliveryZones: ['tunis', 'sfax'],
            carrier: 'aramex',
          });
        });
    });
  });

  describe('profile picture (MinIO)', () => {
    // A real 1×1 PNG.
    const PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );

    it('stores the picture privately and serves it through a signed URL, then deletes it', async () => {
      const server = app.getHttpServer();
      const auth = { Authorization: `Bearer ${token}` };

      await request(server)
        .post('/auth/avatar')
        .set(auth)
        .attach('file', Buffer.from('not an image'), 'photo.png')
        .expect(400);

      const uploaded = await request(server)
        .post('/auth/avatar')
        .set(auth)
        .attach('file', PNG, { filename: 'me.png', contentType: 'image/png' })
        .expect(200);
      const url: string = uploaded.body.avatarUrl;
      expect(url).toMatch(/X-Amz-Signature=/);
      expect(uploaded.body).not.toHaveProperty('avatarKey');

      // The signed URL works like a browser would load it…
      const signed = await fetch(url);
      expect(signed.status).toBe(200);
      expect(signed.headers.get('content-type')).toBe('image/png');
      // …while the same object without a signature is refused: the bucket is private.
      const unsigned = await fetch(url.split('?')[0]);
      expect(unsigned.status).toBe(403);

      await request(server)
        .get('/auth/me')
        .set(auth)
        .expect(200)
        .expect((res) =>
          expect(res.body.avatarUrl).toMatch(/X-Amz-Signature=/),
        );

      await request(server)
        .delete('/auth/avatar')
        .set(auth)
        .expect(200)
        .expect((res) => expect(res.body.avatarUrl).toBeNull());
      expect((await fetch(url)).status).toBe(404);
    });
  });

  describe('appearance', () => {
    it('changes theme and accent, resets the accent with null, refuses bad values', async () => {
      const server = app.getHttpServer();
      const auth = { Authorization: `Bearer ${token}` };

      await request(server)
        .patch('/auth/appearance')
        .set(auth)
        .send({ themeMode: 'sepia' })
        .expect(400);
      await request(server)
        .patch('/auth/appearance')
        .set(auth)
        .send({ accentColor: 'red' })
        .expect(400);

      await request(server)
        .patch('/auth/appearance')
        .set(auth)
        .send({ accentColor: '#0D9488', themeMode: 'dark' })
        .expect(200)
        .expect((res) =>
          expect(res.body).toMatchObject({
            accentColor: '#0d9488',
            themeMode: 'dark',
          }),
        );

      // null goes back to the Ordely blue; the omitted theme stays dark.
      await request(server)
        .patch('/auth/appearance')
        .set(auth)
        .send({ accentColor: null })
        .expect(200);
      const me = await request(server).get('/auth/me').set(auth).expect(200);
      expect(me.body).toMatchObject({ accentColor: null, themeMode: 'dark' });
    });
  });

  describe('dashboard', () => {
    it('returns summary stats and a 7-day series', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.stats.totalOrders).toEqual(
        expect.objectContaining({
          value: expect.any(Number),
          previous: expect.any(Number),
        }),
      );
      expect(res.body.week).toHaveLength(7);
    });

    it('exports calls as CSV', () => {
      return request(app.getHttpServer())
        .get('/calls/export?range=all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect('Content-Type', /text\/csv/)
        .expect((res) =>
          expect(res.text.split('\n')[0]).toMatch(/^call_id,order,customer/),
        );
    });
  });

  describe('orders', () => {
    it('creates, reads, updates and deletes an order', async () => {
      const server = app.getHttpServer();
      const auth = { Authorization: `Bearer ${token}` };

      const created = await request(server)
        .post('/orders')
        .set(auth)
        .send({
          customer: 'E2E',
          phone: '+216 22 000 000',
          items: [{ productName: 'Test item', quantity: 2, unitPrice: 21.25 }],
          total: 42.5,
        })
        .expect(201);
      const id = created.body.id;
      expect(created.body).toMatchObject({ status: 'pending', total: '42.5' });

      await request(server).get(`/orders/${id}`).set(auth).expect(200);

      // Queue a confirmation call; a second one is refused while the first is pending.
      const call = await request(server)
        .post('/calls')
        .set(auth)
        .send({ orderId: id })
        .expect(201);
      expect(call.body).toMatchObject({
        orderId: id,
        status: 'pending',
        attempt: 1,
      });
      await request(server)
        .post('/calls')
        .set(auth)
        .send({ orderId: id })
        .expect(409);
      await request(server)
        .get(`/calls?search=${id}&status=pending`)
        .set(auth)
        .expect(200)
        .expect((res) => {
          expect(res.body.items.map((c: { id: number }) => c.id)).toContain(
            call.body.id,
          );
          expect(res.body.counts.pending).toBeGreaterThanOrEqual(1);
        });

      await request(server)
        .patch(`/orders/${id}`)
        .set(auth)
        .send({ status: 'confirmed' })
        .expect(200)
        .expect((res) => expect(res.body.status).toBe('confirmed'));
      await request(server)
        .patch(`/orders/${id}`)
        .set(auth)
        .send({ customer: '  Edited  ', total: 60 })
        .expect(200)
        .expect((res) =>
          expect(res.body).toMatchObject({
            customer: 'Edited',
            total: '60',
            status: 'confirmed',
          }),
        );
      await request(server)
        .patch(`/orders/${id}`)
        .set(auth)
        .send({ total: -1 })
        .expect(400);
      await request(server).delete(`/orders/${id}`).set(auth).expect(204);
      await request(server).get(`/orders/${id}`).set(auth).expect(404);
    });

    it("keeps each shop's orders, calls and dashboard to itself", async () => {
      const server = app.getHttpServer();
      const auth = { Authorization: `Bearer ${token}` };
      const mine = await request(server)
        .post('/orders')
        .set(auth)
        .send({
          customer: 'Mine',
          phone: '+216 22 000 001',
          items: [{ productName: 'Private item', quantity: 1, unitPrice: 10 }],
          total: 10,
        })
        .expect(201);
      const id = mine.body.id;
      const call = await request(server)
        .post('/calls')
        .set(auth)
        .send({ orderId: id })
        .expect(201);

      await request(server)
        .post('/auth/register')
        .send({ email: otherEmail, name: 'Other', password: PASSWORD })
        .expect(201);
      await prisma.user.update({
        where: { email: otherEmail },
        data: { emailVerifiedAt: new Date() },
      });
      const login = await request(server)
        .post('/auth/login')
        .send({ email: otherEmail, password: PASSWORD })
        .expect(200);
      const other = { Authorization: `Bearer ${login.body.accessToken}` };

      await request(server)
        .get('/orders')
        .set(other)
        .expect(200)
        .expect((res) => expect(res.body).toEqual([]));
      await request(server).get(`/orders/${id}`).set(other).expect(404);
      await request(server)
        .patch(`/orders/${id}`)
        .set(other)
        .send({ status: 'cancelled' })
        .expect(404);
      await request(server).delete(`/orders/${id}`).set(other).expect(404);
      await request(server)
        .post('/calls')
        .set(other)
        .send({ orderId: id })
        .expect(404);
      await request(server)
        .get(`/calls/${call.body.id}`)
        .set(other)
        .expect(404);
      await request(server)
        .get('/calls?range=all')
        .set(other)
        .expect(200)
        .expect((res) => expect(res.body.total).toBe(0));
      await request(server)
        .post('/calls/queue-pending')
        .set(other)
        .expect(201)
        .expect((res) => expect(res.body).toEqual({ queued: 0 }));
      await request(server)
        .get('/dashboard/summary')
        .set(other)
        .expect(200)
        .expect((res) => {
          expect(res.body.pendingCount).toBe(0);
          expect(res.body.stats.totalOrders.value).toBe(0);
        });

      await request(server)
        .get('/analytics?range=7d')
        .set(other)
        .expect(200)
        .expect((res) => {
          expect(res.body.kpis.orders.value).toBe(0);
          expect(res.body.byProduct).toEqual([]);
        });
      await request(server)
        .get('/analytics?range=7d')
        .set(auth)
        .expect(200)
        .expect((res) => {
          expect(res.body.kpis.orders.value).toBeGreaterThanOrEqual(1);
          expect(
            res.body.byProduct.map((p: { item: string }) => p.item),
          ).toContain('Private item');
        });
      await request(server).get('/analytics?range=1y').set(auth).expect(400);

      // Untouched for its owner.
      await request(server)
        .get(`/orders/${id}`)
        .set(auth)
        .expect(200)
        .expect((res) => expect(res.body.status).toBe('pending'));
    });

    it('rejects invalid orders', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ customer: '', items: [] })
        .expect(400);
    });
  });

  describe('password reset', () => {
    it('emails a single-use link that sets the password, ends old sessions and signs in', async () => {
      const server = app.getHttpServer();
      const registered = await request(server)
        .post('/auth/register')
        .send({ email: resetEmail, name: 'Reset', password: PASSWORD })
        .expect(201);
      const oldSession = {
        Authorization: `Bearer ${registered.body.accessToken}`,
      };

      // Unknown addresses get the very same answer.
      await request(server)
        .post('/auth/forgot-password')
        .send({ email: 'nobody-e2e@example.com' })
        .expect(200)
        .expect((res) => expect(res.body).toEqual({ sent: true }));
      await request(server)
        .post('/auth/forgot-password')
        .send({ email: resetEmail.toUpperCase() })
        .expect(200)
        .expect((res) => expect(res.body).toEqual({ sent: true }));
      const mail = sentMail.filter((m) => m.to === resetEmail).pop();
      const linkToken =
        /reset-password\?token=([\w-]+)/.exec(mail?.text ?? '')?.[1] ?? '';
      expect(linkToken).not.toBe('');

      await request(server)
        .post('/auth/reset-password')
        .send({ token: linkToken, password: 'weak' })
        .expect(400);
      // Sessions are dated to the second: make sure the old one is strictly older.
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const NEW_PASSWORD = 'N3w!Passw0rd';
      const reset = await request(server)
        .post('/auth/reset-password')
        .send({ token: linkToken, password: NEW_PASSWORD })
        .expect(200);
      const newSession = { Authorization: `Bearer ${reset.body.accessToken}` };

      // The link proved the address: the new session opens the app right away.
      await request(server).get('/boutique').set(newSession).expect(200);
      await request(server).get('/auth/me').set(oldSession).expect(401);
      await request(server)
        .post('/auth/reset-password')
        .send({ token: linkToken, password: 'An0ther!pass' })
        .expect(400);
      await request(server)
        .post('/auth/login')
        .send({ email: resetEmail, password: PASSWORD })
        .expect(401);
      await request(server)
        .post('/auth/login')
        .send({ email: resetEmail, password: NEW_PASSWORD })
        .expect(200);
    });
  });

  describe('back office (/admin)', () => {
    const ROUTES = [
      '/admin/overview',
      '/admin/usage',
      '/admin/quality',
      '/admin/revenue',
      '/admin/merchants',
      '/admin/cohorts',
      '/admin/export/merchants',
    ];
    const SHOP = `E2E Metrics ${Date.now()}`;
    const CUSTOMER = 'Secret Customer Name';
    const CUSTOMER_PHONE = '+216 99 123 456';
    let admin: { Authorization: string };
    let shopId: number;

    beforeAll(async () => {
      const server = app.getHttpServer();
      await request(server)
        .post('/auth/register')
        .send({ email: adminEmail, name: 'Ordely Admin', password: PASSWORD })
        .expect(201);
      // Granted in the database, as ADMIN_EMAIL does at startup.
      await prisma.user.update({
        where: { email: adminEmail },
        data: { emailVerifiedAt: new Date(), isPlatformAdmin: true },
      });
      const login = await request(server)
        .post('/auth/login')
        .send({ email: adminEmail, password: PASSWORD })
        .expect(200);
      admin = { Authorization: `Bearer ${login.body.accessToken}` };

      // A starter merchant upgraded 10 days ago: 4 orders, 3 finished calls (2 confirmed,
      // 1 refused, 60 s each) and 1 call still queued.
      const DAY = 24 * 60 * 60 * 1000;
      const shop = await prisma.boutique.create({
        data: {
          name: SHOP,
          sector: 'fashion',
          onboardingCompletedAt: new Date(),
          plan: 'starter',
          planStartedAt: new Date(Date.now() - 10 * DAY),
          users: {
            create: {
              email: metricsEmail,
              name: 'Metrics Owner',
              passwordHash: 'x',
              emailVerifiedAt: new Date(),
            },
          },
        },
      });
      shopId = shop.id;
      const calls = [
        { status: 'confirmed', durationSeconds: 60 },
        { status: 'confirmed', durationSeconds: 60 },
        { status: 'failed', durationSeconds: 60 },
        { status: 'pending', durationSeconds: null },
      ];
      for (const call of calls) {
        await prisma.order.create({
          data: {
            boutiqueId: shopId,
            customer: CUSTOMER,
            phone: CUSTOMER_PHONE,
            total: 100,
            items: {
              create: { productName: 'Robe', quantity: 1, unitPrice: 100 },
            },
            calls: { create: { ...call, language: 'French' } },
          },
        });
      }
    });

    it('answers 401 without a session and 403 to a merchant, on every route', async () => {
      const server = app.getHttpServer();
      for (const route of ROUTES) {
        await request(server).get(route).expect(401);
        await request(server)
          .get(route)
          .set('Authorization', `Bearer ${token}`)
          .expect(403);
      }
      await request(server)
        .get(`/admin/merchants/${shopId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      // The role is never settable through the API.
      await request(server)
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Me', isPlatformAdmin: true })
        .expect(400);
    });

    it('serves every report to an admin', async () => {
      const server = app.getHttpServer();
      for (const route of ROUTES) {
        await request(server).get(route).set(admin).expect(200);
      }
      for (const dataset of [
        'overview',
        'usage',
        'quality',
        'revenue',
        'cohorts',
      ]) {
        await request(server)
          .get(`/admin/export/${dataset}?range=7d`)
          .set(admin)
          .expect(200)
          .expect('Content-Type', /text\/csv/);
      }
      await request(server).get('/admin/export/secrets').set(admin).expect(404);
      await request(server)
        .get('/admin/overview?range=custom&from=2026-09-10&to=2026-09-01')
        .set(admin)
        .expect(400);
    });

    it("computes a merchant's numbers from its orders and calls", async () => {
      const server = app.getHttpServer();
      const list = await request(server)
        .get(`/admin/merchants?range=30d&search=${encodeURIComponent(SHOP)}`)
        .set(admin)
        .expect(200);
      expect(list.body.total).toBe(1);
      const row = list.body.rows[0];
      expect(row).toMatchObject({
        id: shopId,
        name: SHOP,
        ownerEmail: metricsEmail,
        plan: 'starter',
        orders: 4,
        calls: 3,
        confirmed: 2,
        refused: 1,
        monthCalls: 3,
        quota: 1500,
        status: 'new',
        // Recency 40 + results round(2/3 × 30) 20 + momentum 20 + setup 10.
        health: 90,
      });
      expect(row.confirmationRate).toBeCloseTo(2 / 3);
      // 79 TND a month, 10 of the last 30 days on the plan.
      expect(row.revenue).toBeCloseTo((79 * 10) / 30, 1);

      const revenue = await request(server)
        .get('/admin/revenue?range=30d')
        .set(admin)
        .expect(200);
      const { perMinute, perCall } = revenue.body.costs;
      expect(row.cost).toBeCloseTo(3 * perMinute + 3 * perCall);
      expect(row.margin).toBeCloseTo(row.revenue - row.cost);

      const detail = await request(server)
        .get(`/admin/merchants/${shopId}?range=7d`)
        .set(admin)
        .expect(200);
      const sum = (k: string) =>
        detail.body.daily.reduce(
          (s: number, d: Record<string, number>) => s + d[k],
          0,
        );
      expect(detail.body.daily).toHaveLength(7);
      expect([sum('orders'), sum('calls'), sum('confirmed')]).toEqual([
        4, 3, 2,
      ]);

      // Never an end customer's name or phone number, in any report or export.
      for (const route of [
        `/admin/merchants/${shopId}`,
        '/admin/merchants',
        '/admin/quality',
        '/admin/usage',
        '/admin/revenue',
        '/admin/export/merchants',
        '/admin/export/quality',
      ]) {
        const res = await request(server).get(route).set(admin).expect(200);
        expect(res.text).not.toContain(CUSTOMER);
        expect(res.text).not.toContain(CUSTOMER_PHONE);
      }
    });

    it("leaves the Ordely team's own shops out of the merchants", async () => {
      const server = app.getHttpServer();
      const me = await prisma.user.findUniqueOrThrow({
        where: { email: adminEmail },
      });
      await request(server)
        .get(`/admin/merchants?search=${encodeURIComponent(adminEmail)}`)
        .set(admin)
        .expect(200)
        .expect((res) => expect(res.body.total).toBe(0));
      await request(server)
        .get(`/admin/merchants/${me.boutiqueId}`)
        .set(admin)
        .expect(404);
    });
  });
});
