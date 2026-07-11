import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RivalriesService } from './rivalries.service';
import { RivalriesController } from './rivalries.controller';

@Module({
  imports: [PrismaModule],
  controllers: [RivalriesController],
  providers: [RivalriesService],
  exports: [RivalriesService], // ScheduleModule recomputes after simulating a week
})
export class RivalriesModule {}
