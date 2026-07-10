import { Module } from '@nestjs/common';
import { DepthChartsController } from './depth-charts.controller';
import { DepthChartsService } from './depth-charts.service';
import { TeamByParamOwnershipGuard } from '../common/guards/ownership.guards';

@Module({
  controllers: [DepthChartsController],
  providers: [DepthChartsService, TeamByParamOwnershipGuard],
  exports: [DepthChartsService],
})
export class DepthChartsModule {}
