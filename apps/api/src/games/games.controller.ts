import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { GamesService } from './games.service';
import { SimulateGameDto } from './dto/simulate-game.dto';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/trusted-proxy-user.middleware';
import {
  LeagueByParamCapabilityGuard,
  RequireCapability,
} from '../common/guards/capability.guards';
import { LeagueByParamReadAccessGuard } from '../common/guards/read-access.guards';

// Games are nested under a league. Simulating is the `simulate` capability (owner/commissioner);
// reading a box score is available to anyone with league read access (owner or any member), so a
// member can review results of games in a league they belong to.
@Controller('leagues/:leagueId/games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post('simulate')
  @RequireCapability('simulate')
  @UseGuards(LeagueByParamCapabilityGuard)
  simulate(
    @Param('leagueId') leagueId: string,
    @Body() dto: SimulateGameDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.gamesService.simulate(dto, user.id, leagueId);
  }

  @Get(':id/box-score')
  @UseGuards(LeagueByParamReadAccessGuard)
  boxScore(@Param('leagueId') leagueId: string, @Param('id') id: string) {
    return this.gamesService.getBoxScore(id, leagueId);
  }
}
