import { Module } from '@nestjs/common';
import { RostersController } from './rosters.controller';
import { RostersService } from './rosters.service';
import { RosterOwnershipGuard } from '../common/guards/ownership.guards';

@Module({
  controllers: [RostersController],
  providers: [RostersService, RosterOwnershipGuard],
  exports: [RostersService],
})
export class RostersModule {}
