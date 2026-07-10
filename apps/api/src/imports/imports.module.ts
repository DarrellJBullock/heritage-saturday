import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { ImportOwnershipGuard } from '../common/guards/ownership.guards';

@Module({
  controllers: [ImportsController],
  providers: [ImportsService, ImportOwnershipGuard],
})
export class ImportsModule {}
