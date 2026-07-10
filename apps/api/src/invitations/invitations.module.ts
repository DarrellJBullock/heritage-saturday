import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { LeagueInvitationsController } from './league-invitations.controller';
import { InvitationsInboxController } from './invitations-inbox.controller';

@Module({
  controllers: [LeagueInvitationsController, InvitationsInboxController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
