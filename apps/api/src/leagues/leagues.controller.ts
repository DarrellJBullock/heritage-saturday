import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CreateLeagueRequestDto, LEAGUE_SIZES, LeagueSize } from '@heritage-saturday/shared';
import { LeaguesService } from './leagues.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/trusted-proxy-user.middleware';
import { LeagueReadAccessGuard } from '../common/guards/read-access.guards';
import { DomainException } from '../common/errors/domain-exception';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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
    return this.leaguesService.listForUser(user.id);
  }

  @Get(':id')
  @UseGuards(LeagueReadAccessGuard)
  detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.leaguesService.getDetail(id, user.id);
  }

  // Download the league's teams + players as an .xlsx, in the import column layout (round-trips).
  @Get(':id/export')
  @UseGuards(LeagueReadAccessGuard)
  async export(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const { fileName, buffer } = await this.leaguesService.exportWorkbook(id);
    res.set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    return new StreamableFile(buffer);
  }
}
