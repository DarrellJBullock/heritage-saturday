import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { AddMemberRequestDto } from '@heritage-saturday/shared';
import { MembersService } from './members.service';
import { LeagueByParamOwnershipGuard } from '../common/guards/ownership.guards';
import { LeagueByParamReadAccessGuard } from '../common/guards/read-access.guards';

// League membership. Adding/removing is owner-only; listing is available to the owner or any
// member (so a member can see who else is in the league).
@Controller('leagues/:leagueId/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post()
  @HttpCode(HttpStatus.OK) // idempotent add, not a fresh resource each call
  @UseGuards(LeagueByParamOwnershipGuard)
  add(@Param('leagueId') leagueId: string, @Body() dto: AddMemberRequestDto) {
    return this.membersService.addByEmail(leagueId, dto?.email);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(LeagueByParamOwnershipGuard)
  async remove(@Param('leagueId') leagueId: string, @Param('userId') userId: string) {
    await this.membersService.remove(leagueId, userId);
  }

  @Get()
  @UseGuards(LeagueByParamReadAccessGuard)
  list(@Param('leagueId') leagueId: string) {
    return this.membersService.list(leagueId);
  }
}
