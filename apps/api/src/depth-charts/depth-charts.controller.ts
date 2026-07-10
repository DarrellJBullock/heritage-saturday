import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DepthChartsService } from './depth-charts.service';
import { TeamByParamOwnershipGuard } from '../common/guards/ownership.guards';

@Controller('depth-charts')
export class DepthChartsController {
  constructor(private readonly depthChartsService: DepthChartsService) {}

  @Get(':teamId')
  @UseGuards(TeamByParamOwnershipGuard)
  get(@Param('teamId') teamId: string) {
    return this.depthChartsService.getOrGenerate(teamId);
  }
}
