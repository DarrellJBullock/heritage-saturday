import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { TeamOwnershipGuard } from '../common/guards/ownership.guards';

@Module({
  controllers: [TeamsController],
  providers: [TeamsService, TeamOwnershipGuard],
  exports: [TeamsService],
})
export class TeamsModule {}
