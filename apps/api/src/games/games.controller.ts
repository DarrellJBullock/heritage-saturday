import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { GamesService } from './games.service';
import { SimulateGameDto } from './dto/simulate-game.dto';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/trusted-proxy-user.middleware';
import { GameOwnershipGuard } from '../common/guards/ownership.guards';

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post('simulate')
  simulate(@Body() dto: SimulateGameDto, @CurrentUser() user: RequestUser) {
    return this.gamesService.simulate(dto, user.id);
  }

  @Get(':id/box-score')
  @UseGuards(GameOwnershipGuard)
  boxScore(@Param('id') id: string) {
    return this.gamesService.getBoxScore(id);
  }
}
