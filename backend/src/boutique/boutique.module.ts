import { Module } from '@nestjs/common';
import { BoutiqueController } from './boutique.controller';
import { BoutiqueService } from './boutique.service';

@Module({
  controllers: [BoutiqueController],
  providers: [BoutiqueService],
})
export class BoutiqueModule {}
