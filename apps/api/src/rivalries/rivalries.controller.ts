import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { RivalriesService } from './rivalries.service';
import { LeagueByParamReadAccessGuard } from '../common/guards/read-access.guards';
import {
  LeagueByParamCapabilityGuard,
  RequireCapability,
} from '../common/guards/capability.guards';

// Rivalries live under a league. Reading needs league read access (owner or member); approving
// or dismissing an emerging rivalry is the `rivalries:manage` capability (owner/commissioner).
@Controller('leagues/:leagueId/rivalries')
export class RivalriesController {
  constructor(private readonly rivalriesService: RivalriesService) {}

  @Get()
  @UseGuards(LeagueByParamReadAccessGuard)
  list(@Param('leagueId') leagueId: string) {
    return this.rivalriesService.getRivalries(leagueId);
  }

  @Post(':rivalryId/approve')
  @HttpCode(HttpStatus.OK)
  @RequireCapability('rivalries:manage')
  @UseGuards(LeagueByParamCapabilityGuard)
  approve(@Param('leagueId') leagueId: string, @Param('rivalryId') rivalryId: string) {
    return this.rivalriesService.approve(rivalryId, leagueId);
  }

  @Post(':rivalryId/dismiss')
  @HttpCode(HttpStatus.OK)
  @RequireCapability('rivalries:manage')
  @UseGuards(LeagueByParamCapabilityGuard)
  dismiss(@Param('leagueId') leagueId: string, @Param('rivalryId') rivalryId: string) {
    return this.rivalriesService.dismiss(rivalryId, leagueId);
  }
}
