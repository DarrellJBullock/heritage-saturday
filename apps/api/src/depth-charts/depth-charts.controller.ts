import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { DepthChartsService } from './depth-charts.service';
import { TeamByParamReadAccessGuard } from '../common/guards/read-access.guards';
import { TeamByParamOwnershipGuard } from '../common/guards/ownership.guards';
import { SaveDepthChartRequestDto } from '@heritage-saturday/shared';

@Controller('depth-charts')
export class DepthChartsController {
  constructor(private readonly depthChartsService: DepthChartsService) {}

  @Get(':teamId')
  @UseGuards(TeamByParamReadAccessGuard)
  get(@Param('teamId') teamId: string) {
    return this.depthChartsService.getOrGenerate(teamId);
  }

  // Owner-only: replace the team's depth chart by hand.
  @Put(':teamId')
  @UseGuards(TeamByParamOwnershipGuard)
  save(@Param('teamId') teamId: string, @Body() dto: SaveDepthChartRequestDto) {
    return this.depthChartsService.saveManual(teamId, dto?.entries ?? []);
  }
}
