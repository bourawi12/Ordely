import { Body, Controller, Get, Headers, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { CurrentBoutique } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { ExternalOrderDto } from './dto/external-order.dto';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  list(@CurrentBoutique() boutiqueId: number) {
    return this.integrationsService.listConnections(boutiqueId);
  }

  @Get('internal/orders/:externalOrderId/orchestration')
  async orchestrationStatus(
    @CurrentBoutique() boutiqueId: number,
    @Param('externalOrderId') externalOrderId: string,
  ) {
    const status = await this.integrationsService.orchestrationStatus(
      boutiqueId,
      externalOrderId,
    );
    if (!status) throw new NotFoundException('External order not found');
    return status;
  }

  @Post('custom-api')
  createCustomApi(
    @CurrentBoutique() boutiqueId: number,
    @Body() dto: CreateConnectionDto,
  ) {
    return this.integrationsService.createCustomApiConnection(boutiqueId, dto);
  }

  @Patch('custom-api')
  updateCustomApi(
    @CurrentBoutique() boutiqueId: number,
    @Body() dto: CreateConnectionDto,
  ) {
    return this.integrationsService.updateCustomApiConnection(boutiqueId, dto);
  }

  @Public()
  @Post('custom-api/orders')
  ingestOrder(
    @Headers('x-ordely-api-key') apiKey: string | undefined,
    @Body() dto: ExternalOrderDto,
  ) {
    return this.integrationsService.ingestExternalOrder(apiKey, dto);
  }
}