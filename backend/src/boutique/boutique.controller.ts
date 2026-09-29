import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import { BoutiqueService } from './boutique.service';
import { AgentDto } from './dto/agent.dto';
import { DetailsDto } from './dto/details.dto';
import { IdentityDto } from './dto/identity.dto';

/** The signed-in merchant's boutique and its onboarding screens. */
@Controller('boutique')
export class BoutiqueController {
  constructor(private readonly boutiqueService: BoutiqueService) {}

  @Get()
  get(@CurrentUser() user: JwtPayload) {
    return this.boutiqueService.get(user.sub);
  }

  @Patch('identity')
  identity(@CurrentUser() user: JwtPayload, @Body() dto: IdentityDto) {
    return this.boutiqueService.updateIdentity(user.sub, dto);
  }

  @Patch('agent')
  agent(@CurrentUser() user: JwtPayload, @Body() dto: AgentDto) {
    return this.boutiqueService.updateAgent(user.sub, dto);
  }

  @Patch('details')
  details(@CurrentUser() user: JwtPayload, @Body() dto: DetailsDto) {
    return this.boutiqueService.updateDetails(user.sub, dto);
  }

  @Post('onboarding/complete')
  @HttpCode(200)
  complete(@CurrentUser() user: JwtPayload) {
    return this.boutiqueService.completeOnboarding(user.sub);
  }
}
