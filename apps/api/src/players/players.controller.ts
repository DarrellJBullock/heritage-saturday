import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { PlayersService } from './players.service';
import { PlayerReadAccessGuard } from '../common/guards/read-access.guards';
import { PlayerOwnershipGuard } from '../common/guards/ownership.guards';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/trusted-proxy-user.middleware';
import { SetHeadshotRequestDto } from '@heritage-saturday/shared';

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get(':id')
  @UseGuards(PlayerReadAccessGuard)
  detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.playersService.getDetail(id, user.id);
  }

  // Owner-only: set or clear the player's headshot photo URL.
  @Patch(':id/headshot')
  @UseGuards(PlayerOwnershipGuard)
  setHeadshot(
    @Param('id') id: string,
    @Body() dto: SetHeadshotRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.playersService.setHeadshot(id, dto?.headshotUrl ?? null, user.id);
  }
}
