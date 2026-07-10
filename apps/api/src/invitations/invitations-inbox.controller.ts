import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/trusted-proxy-user.middleware';

// The invitee side: a caller's own inbox. No league guard — authorization is email ownership,
// enforced in the service (an invitation is only visible/actionable to the account whose email
// it was sent to).
@Controller('invitations')
export class InvitationsInboxController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.invitationsService.listForUser(user.id);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  accept(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.invitationsService.accept(id, user.id);
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  async decline(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.invitationsService.decline(id, user.id);
  }
}
