import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { ImportOwnershipGuard } from '../common/guards/ownership.guards';
import { RostersModule } from '../rosters/rosters.module';

@Module({
  imports: [RostersModule],
  controllers: [ImportsController],
  providers: [ImportsService, ImportOwnershipGuard],
})
export class ImportsModule {}
