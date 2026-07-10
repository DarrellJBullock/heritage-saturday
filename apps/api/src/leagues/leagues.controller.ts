import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CreateLeagueRequestDto, LEAGUE_SIZES, LeagueSize } from '@heritage-saturday/shared';
import { LeaguesService } from './leagues.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/trusted-proxy-user.middleware';
import { LeagueOwnershipGuard } from '../common/guards/ownership.guards';
import { DomainException } from '../common/errors/domain-exception';

@Controller('leagues')
export class LeaguesController {
  constructor(private readonly leaguesService: LeaguesService) {}

  @Post()
  create(@Body() dto: CreateLeagueRequestDto, @CurrentUser() user: RequestUser) {
    // No global ValidationPipe in this app; controllers validate and throw DomainException.
    if (!(LEAGUE_SIZES as readonly number[]).includes(dto?.size)) {
      throw new DomainException(400, 'BAD_REQUEST', `size must be one of ${LEAGUE_SIZES.join(', ')}`);
    }
    return this.leaguesService.create({ ...dto, size: dto.size as LeagueSize }, user.id);
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.leaguesService.listForOwner(user.id);
  }

  @Get(':id')
  @UseGuards(LeagueOwnershipGuard)
  detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.leaguesService.getDetail(id, user.id);
  }
}
