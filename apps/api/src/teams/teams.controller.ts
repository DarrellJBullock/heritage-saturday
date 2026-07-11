import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/trusted-proxy-user.middleware';
import { TeamReadAccessGuard } from '../common/guards/read-access.guards';
import { TeamOwnershipGuard } from '../common/guards/ownership.guards';
import { SetTeamColorsRequestDto } from '@heritage-saturday/shared';

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

  @Get(':id')
  @UseGuards(TeamReadAccessGuard)
  detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.teamsService.getDetail(id, user.id);
  }

  @Get(':id/players')
  @UseGuards(TeamReadAccessGuard)
  players(@Param('id') id: string) {
    return this.teamsService.listPlayers(id);
  }

  // Owner-only: set the team's colors.
  @Patch(':id/colors')
  @UseGuards(TeamOwnershipGuard)
  setColors(
    @Param('id') id: string,
    @Body() dto: SetTeamColorsRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.teamsService.setColors(id, dto, user.id);
  }
}
