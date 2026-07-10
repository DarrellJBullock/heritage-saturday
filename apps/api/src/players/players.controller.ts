import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PlayersService } from './players.service';
import { PlayerReadAccessGuard } from '../common/guards/read-access.guards';

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get(':id')
  @UseGuards(PlayerReadAccessGuard)
  detail(@Param('id') id: string) {
    return this.playersService.getDetail(id);
  }
}
