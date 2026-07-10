import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RostersService } from './rosters.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/trusted-proxy-user.middleware';
import { RosterOwnershipGuard } from '../common/guards/ownership.guards';

@Controller('rosters')
export class RostersController {
  constructor(private readonly rostersService: RostersService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.rostersService.listForOwner(user.id);
  }

  @Get(':id')
  @UseGuards(RosterOwnershipGuard)
  detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.rostersService.getDetail(id, user.id);
  }
}
