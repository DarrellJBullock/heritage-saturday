import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import {
  LeagueByParamCapabilityGuard,
  RequireCapability,
} from '../common/guards/capability.guards';
import { LeagueByParamReadAccessGuard } from '../common/guards/read-access.guards';

// Schedule and standings live under a league. Reading them needs only league read access (owner
// or any member); generating and advancing the season is the `simulate` capability
// (owner/commissioner).
@Controller('leagues/:leagueId')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post('schedule')
  @RequireCapability('simulate')
  @UseGuards(LeagueByParamCapabilityGuard)
  generate(@Param('leagueId') leagueId: string) {
    return this.scheduleService.generate(leagueId);
  }

  @Get('schedule')
  @UseGuards(LeagueByParamReadAccessGuard)
  schedule(@Param('leagueId') leagueId: string) {
    return this.scheduleService.getSchedule(leagueId);
  }

  @Post('schedule/simulate-week')
  @HttpCode(HttpStatus.OK) // advancing the season is not a resource creation
  @RequireCapability('simulate')
  @UseGuards(LeagueByParamCapabilityGuard)
  simulateWeek(@Param('leagueId') leagueId: string) {
    return this.scheduleService.simulateWeek(leagueId);
  }

  @Get('standings')
  @UseGuards(LeagueByParamReadAccessGuard)
  standings(@Param('leagueId') leagueId: string) {
    return this.scheduleService.getStandings(leagueId);
  }
}
