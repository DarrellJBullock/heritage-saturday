import { Module } from '@nestjs/common';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { GamesModule } from '../games/games.module';
import { RivalriesModule } from '../rivalries/rivalries.module';

@Module({
  imports: [GamesModule, RivalriesModule],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
