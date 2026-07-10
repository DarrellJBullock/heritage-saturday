import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { GamesService } from './games.service';
import { SimulateGameDto } from './dto/simulate-game.dto';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/trusted-proxy-user.middleware';
import { GameOwnershipGuard, LeagueByParamOwnershipGuard } from '../common/guards/ownership.guards';

// Games are nested under a league. The controller-level guard verifies the caller owns the
// league in the path; the service additionally checks both teams belong to it.
@Controller('leagues/:leagueId/games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post('simulate')
  @UseGuards(LeagueByParamOwnershipGuard)
  simulate(
    @Param('leagueId') leagueId: string,
    @Body() dto: SimulateGameDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.gamesService.simulate(dto, user.id, leagueId);
  }

  @Get(':id/box-score')
  @UseGuards(LeagueByParamOwnershipGuard, GameOwnershipGuard)
  boxScore(@Param('id') id: string) {
    return this.gamesService.getBoxScore(id);
  }
}
