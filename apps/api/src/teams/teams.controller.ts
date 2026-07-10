import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/trusted-proxy-user.middleware';
import { TeamOwnershipGuard } from '../common/guards/ownership.guards';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  list(@Query('rosterId') rosterId: string, @CurrentUser() user: RequestUser) {
    if (!rosterId) {
      throw new BadRequestException({ statusCode: 400, error: 'BAD_REQUEST', message: 'rosterId query param is required' });
    }
    return this.teamsService.listForRoster(rosterId, user.id);
  }

  @Get(':id/players')
  @UseGuards(TeamOwnershipGuard)
  players(@Param('id') id: string) {
    return this.teamsService.listPlayers(id);
  }
}
