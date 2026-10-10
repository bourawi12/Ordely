import { Body, Controller, Get, Headers, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { CurrentBoutique } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { CreateIntegrationOrderDto } from './dto/create-integration-order.dto';
import { UpdateIntegrationDto } from './dto/update-integration.dto';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  get(@CurrentBoutique() boutiqueId: number) {
    return this.integrationsService.get(boutiqueId);
  }

  @Post()
  create(@CurrentBoutique() boutiqueId: number, @Body() dto: UpdateIntegrationDto) {
    return this.integrationsService.create(boutiqueId, dto);
  }

  @Patch()
  update(@CurrentBoutique() boutiqueId: number, @Body() dto: UpdateIntegrationDto) {
    return this.integrationsService.update(boutiqueId, dto);
  }

  @Post('test')
  test(@CurrentBoutique() boutiqueId: number) {
    return this.integrationsService.test(boutiqueId);
  }

  @Post('orders')
  @Public()
  receiveOrder(@Headers('authorization') authorization: string | undefined, @Body() dto: CreateIntegrationOrderDto) {
    const [scheme, token] = authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Missing integration credentials.');
    return this.integrationsService.receiveOrder(token, dto);
  }
}