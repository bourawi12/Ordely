import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { BoutiqueModule } from './boutique/boutique.module';
import { CallsModule } from './calls/calls.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MailModule } from './mail/mail.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ReclamationsModule } from './reclamations/reclamations.module';
import { StorageModule } from './storage/storage.module';
import { VoiceModule } from './voice/voice.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    // Limits are set per route with @Throttle(); only auth routes apply the guard.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    StorageModule,
    MailModule,
    AuthModule,
    BoutiqueModule,
    OrdersModule,
    VoiceModule,
    CallsModule,
    DashboardModule,
    AnalyticsModule,
    RealtimeModule,
    ReclamationsModule,
    AdminModule,
    VoiceModule,
    BillingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
