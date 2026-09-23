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
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('/health (GET) is public and reports the database as up', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
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

    it('rejects weak registrations', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', name: '', password: 'short' })
        .expect(400);
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
