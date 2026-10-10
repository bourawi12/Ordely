import { Module } from '@nestjs/common';
import { ReclamationsAdminController } from './reclamations-admin.controller';
import { ReclamationsController } from './reclamations.controller';
import { ReclamationsService } from './reclamations.service';

@Module({
  controllers: [ReclamationsController, ReclamationsAdminController],
  providers: [ReclamationsService],
})
export class ReclamationsModule {}