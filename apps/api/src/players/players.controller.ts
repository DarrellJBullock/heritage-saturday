import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PlayersService } from './players.service';
import { PlayerOwnershipGuard } from '../common/guards/ownership.guards';

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get(':id')
  @UseGuards(PlayerOwnershipGuard)
  detail(@Param('id') id: string) {
    return this.playersService.getDetail(id);
  }
}
