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
import { RequestUser } from '../common/auth/auth-stub.middleware';
import { ImportOwnershipGuard } from '../common/guards/ownership.guards';

@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('roster')
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: RequestUser) {
    return this.importsService.uploadRoster(file, user.id);
  }

  @Get(':id/preview')
  @UseGuards(ImportOwnershipGuard)
  preview(@Param('id') id: string) {
    return this.importsService.preview(id);
  }

  @Post(':id/commit')
  @HttpCode(HttpStatus.OK) // architecture.md §391: commit → 200, not Nest's POST default of 201
  @UseGuards(ImportOwnershipGuard)
  commit(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.importsService.commit(id, user.id);
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.importsService.listForOwner(user.id);
  }
}
