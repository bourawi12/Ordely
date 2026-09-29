import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

// Runs against the database in DATABASE_URL (e.g. `docker compose up -d db`).
describe('App (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  const email = `e2e-${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
    const users = await prisma.user.findMany({ where: { email } });
    await prisma.user.deleteMany({ where: { email } });
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
          password: 'password123',
        })
        .expect(201);
      expect(registered.body.user).toMatchObject({ email, name: 'E2E User' });
      expect(registered.body.user).not.toHaveProperty('passwordHash');

      await request(server)
        .post('/auth/register')
        .send({ email, name: 'Again', password: 'password123' })
        .expect(409);

      await request(server)
        .post('/auth/login')
        .send({ email, password: 'wrong-password' })
        .expect(401);

      const login = await request(server)
        .post('/auth/login')
        .send({ email, password: 'password123' })
        .expect(200);
      token = login.body.accessToken;

      await request(server)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => expect(res.body.email).toBe(email));
    });

    it('stores the look chosen at sign-up and refuses a bad colour', async () => {
      const server = app.getHttpServer();
      const themed = `themed-${email}`;
      await request(server)
        .post('/auth/register')
        .send({
          email: themed,
          name: 'Themed',
          password: 'password123',
          accentColor: 'purple',
        })
        .expect(400);
      const res = await request(server)
        .post('/auth/register')
        .send({
          email: themed,
          name: 'Themed',
          password: 'password123',
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

    it('rejects weak registrations', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', name: '', password: 'short' })
        .expect(400);
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
          item: 'Test item',
          quantity: 2,
          total: 42.5,
        })
        .expect(201);
      const id = created.body.id;
      expect(created.body).toMatchObject({ status: 'pending', quantity: 2 });

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
      await request(server).delete(`/orders/${id}`).set(auth).expect(204);
      await request(server).get(`/orders/${id}`).set(auth).expect(404);
    });

    it('rejects invalid orders', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ customer: '', quantity: 0 })
        .expect(400);
    });
  });
});
