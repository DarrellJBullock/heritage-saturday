import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { RostersService } from './rosters.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/trusted-proxy-user.middleware';
import { RosterReadAccessGuard } from '../common/guards/read-access.guards';
import { RosterCapabilityGuard, RequireCapability } from '../common/guards/capability.guards';
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

  @Patch(':id/visibility')
  @RequireCapability('roster:visibility')
  @UseGuards(RosterCapabilityGuard)
  setVisibility(@Param('id') id: string, @Body() dto: SetRosterVisibilityRequestDto) {
    if (!(VISIBILITIES as readonly string[]).includes(dto?.visibility)) {
      throw new DomainException(400, 'BAD_REQUEST', `visibility must be one of ${VISIBILITIES.join(', ')}`);
    }
    return this.rostersService.setVisibility(id, dto.visibility);
  }

  // Lifecycle: archive (soft, reversible), restore, delete (permanent, blocked once teams have
  // games). Gated by the `import` capability — the same roster-content management level.
  @Patch(':id/archive')
  @RequireCapability('import')
  @UseGuards(RosterCapabilityGuard)
  archive(@Param('id') id: string) {
    return this.rostersService.archive(id);
  }

  @Patch(':id/restore')
  @RequireCapability('import')
  @UseGuards(RosterCapabilityGuard)
  restore(@Param('id') id: string) {
    return this.rostersService.restore(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireCapability('import')
  @UseGuards(RosterCapabilityGuard)
  async remove(@Param('id') id: string) {
    await this.rostersService.deleteRoster(id);
  }
}
