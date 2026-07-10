import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AddMemberRequestDto, SetMemberRoleRequestDto } from '@heritage-saturday/shared';
import { MembersService } from './members.service';
import {
  LeagueByParamCapabilityGuard,
  RequireCapability,
} from '../common/guards/capability.guards';
import { LeagueByParamReadAccessGuard } from '../common/guards/read-access.guards';

// League membership & roles. Adding/removing/role-changing is the `members:manage` capability
// (owner-only today); listing is available to the owner or any member.
@Controller('leagues/:leagueId/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post()
  @HttpCode(HttpStatus.OK) // idempotent add, not a fresh resource each call
  @RequireCapability('members:manage')
  @UseGuards(LeagueByParamCapabilityGuard)
  add(@Param('leagueId') leagueId: string, @Body() dto: AddMemberRequestDto) {
    return this.membersService.addByEmail(leagueId, dto?.email, dto?.role);
  }

  @Patch(':userId')
  @RequireCapability('members:manage')
  @UseGuards(LeagueByParamCapabilityGuard)
  setRole(
    @Param('leagueId') leagueId: string,
    @Param('userId') userId: string,
    @Body() dto: SetMemberRoleRequestDto,
  ) {
    return this.membersService.setRole(leagueId, userId, dto?.role);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireCapability('members:manage')
  @UseGuards(LeagueByParamCapabilityGuard)
  async remove(@Param('leagueId') leagueId: string, @Param('userId') userId: string) {
    await this.membersService.remove(leagueId, userId);
  }

  @Get()
  @UseGuards(LeagueByParamReadAccessGuard)
  list(@Param('leagueId') leagueId: string) {
    return this.membersService.list(leagueId);
  }
}
