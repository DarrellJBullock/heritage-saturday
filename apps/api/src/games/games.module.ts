import { Module } from '@nestjs/common';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { GameOwnershipGuard } from '../common/guards/ownership.guards';
import { DepthChartsModule } from '../depth-charts/depth-charts.module';

@Module({
  imports: [DepthChartsModule],
  controllers: [GamesController],
  providers: [GamesService, GameOwnershipGuard],
})
export class GamesModule {}
