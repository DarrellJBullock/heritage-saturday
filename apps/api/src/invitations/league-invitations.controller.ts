import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateInvitationRequestDto } from '@heritage-saturday/shared';
import { InvitationsService } from './invitations.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/trusted-proxy-user.middleware';
import {
  LeagueByParamCapabilityGuard,
  RequireCapability,
} from '../common/guards/capability.guards';

// The owner/commissioner side of invitations, gated by `members:manage`.
@Controller('leagues/:leagueId/invitations')
@RequireCapability('members:manage')
@UseGuards(LeagueByParamCapabilityGuard)
export class LeagueInvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @HttpCode(HttpStatus.OK) // upsert of a pending invite, not a fresh resource each call
  create(
    @Param('leagueId') leagueId: string,
    @Body() dto: CreateInvitationRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.invitationsService.create(leagueId, dto?.email, dto?.role, user.id);
  }

  @Get()
  list(@Param('leagueId') leagueId: string) {
    return this.invitationsService.listForLeague(leagueId);
  }

  @Delete(':invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('leagueId') leagueId: string, @Param('invitationId') invitationId: string) {
    await this.invitationsService.revoke(leagueId, invitationId);
  }
}
