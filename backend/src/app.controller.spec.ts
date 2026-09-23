import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  const $queryRaw = jest.fn();

  beforeEach(async () => {
    $queryRaw.mockReset();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: { $queryRaw } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports ok when the database responds', async () => {
      $queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      await expect(appController.getHealth()).resolves.toMatchObject({
        status: 'ok',
        database: 'up',
      });
    });

    it('reports degraded when the database is unreachable', async () => {
      $queryRaw.mockRejectedValue(new Error('connection refused'));
      await expect(appController.getHealth()).resolves.toMatchObject({
        status: 'degraded',
        database: 'down',
      });
    });
  });
});
