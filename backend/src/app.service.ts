import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { StorageService } from './storage/storage.service';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getHealth() {
    let database: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    const storage: 'up' | 'down' = (await this.storage.isUp()) ? 'up' : 'down';
    return {
      // Without the database nothing works; without storage only uploads do.
      status: database === 'up' && storage === 'up' ? 'ok' : 'degraded',
      database,
      storage,
      timestamp: new Date().toISOString(),
    };
  }
}
