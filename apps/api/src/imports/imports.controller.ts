import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportsService } from './imports.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/trusted-proxy-user.middleware';
import {
  LeagueByParamCapabilityGuard,
  RequireCapability,
} from '../common/guards/capability.guards';

// Imports are nested under a league — a roster is always imported *into* a league. Importing is
// the `import` capability (owner/commissioner/manager); the whole controller is gated by it, so
// the import history/preview reads are a management view too. The service checks that any import
// addressed by id also belongs to that league (404 otherwise).
@Controller('leagues/:leagueId/imports')
@RequireCapability('import')
@UseGuards(LeagueByParamCapabilityGuard)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('roster')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('leagueId') leagueId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    return this.importsService.uploadRoster(file, user.id, leagueId);
  }

  @Get(':id/preview')
  preview(@Param('leagueId') leagueId: string, @Param('id') id: string) {
    return this.importsService.preview(id, leagueId);
  }

  @Post(':id/commit')
  @HttpCode(HttpStatus.OK) // architecture.md §391: commit → 200, not Nest's POST default of 201
  commit(
    @Param('leagueId') leagueId: string,
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.importsService.commit(id, user.id, leagueId);
  }

  @Get()
  list(@Param('leagueId') leagueId: string) {
    return this.importsService.listForLeague(leagueId);
  }
}
