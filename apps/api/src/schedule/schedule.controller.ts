import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { LeagueByParamOwnershipGuard } from '../common/guards/ownership.guards';

// Schedule and standings are nested under a league and gated by league ownership. Both live in
// one controller because they share the same base path and guard.
@Controller('leagues/:leagueId')
@UseGuards(LeagueByParamOwnershipGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post('schedule')
  generate(@Param('leagueId') leagueId: string) {
    return this.scheduleService.generate(leagueId);
  }

  @Get('schedule')
  schedule(@Param('leagueId') leagueId: string) {
    return this.scheduleService.getSchedule(leagueId);
  }

  @Post('schedule/simulate-week')
  @HttpCode(HttpStatus.OK) // advancing the season is not a resource creation
  simulateWeek(@Param('leagueId') leagueId: string) {
    return this.scheduleService.simulateWeek(leagueId);
  }

  @Get('standings')
  standings(@Param('leagueId') leagueId: string) {
    return this.scheduleService.getStandings(leagueId);
  }
}
