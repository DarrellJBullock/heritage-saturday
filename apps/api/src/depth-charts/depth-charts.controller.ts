import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DepthChartsService } from './depth-charts.service';
import { TeamByParamReadAccessGuard } from '../common/guards/read-access.guards';

@Controller('depth-charts')
export class DepthChartsController {
  constructor(private readonly depthChartsService: DepthChartsService) {}

  @Get(':teamId')
  @UseGuards(TeamByParamReadAccessGuard)
  get(@Param('teamId') teamId: string) {
    return this.depthChartsService.getOrGenerate(teamId);
  }
}
