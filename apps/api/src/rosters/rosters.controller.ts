import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { RostersService } from './rosters.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/trusted-proxy-user.middleware';
import { RosterOwnershipGuard } from '../common/guards/ownership.guards';
import { RosterReadAccessGuard } from '../common/guards/read-access.guards';
import { SetRosterVisibilityRequestDto, VISIBILITIES } from '@heritage-saturday/shared';
import { DomainException } from '../common/errors/domain-exception';

@Controller('rosters')
export class RostersController {
  constructor(private readonly rostersService: RostersService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.rostersService.listForOwner(user.id);
  }

  // Read access: the owner, or a member of the league if the roster is LEAGUE-visible.
  @Get(':id')
  @UseGuards(RosterReadAccessGuard)
  detail(@Param('id') id: string) {
    return this.rostersService.getDetail(id);
  }

  // Owner-only: promote/demote a roster's visibility. Owner-only guard, not the read guard.
  @Patch(':id/visibility')
  @UseGuards(RosterOwnershipGuard)
  setVisibility(@Param('id') id: string, @Body() dto: SetRosterVisibilityRequestDto) {
    if (!(VISIBILITIES as readonly string[]).includes(dto?.visibility)) {
      throw new DomainException(400, 'BAD_REQUEST', `visibility must be one of ${VISIBILITIES.join(', ')}`);
    }
    return this.rostersService.setVisibility(id, dto.visibility);
  }
}
