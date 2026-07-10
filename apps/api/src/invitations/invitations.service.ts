import { Injectable } from '@nestjs/common';
import { Invitation, League, User } from '@prisma/client';
import { InvitationDto, MEMBER_ROLES, MemberRole } from '@heritage-saturday/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { DomainException } from '../common/errors/domain-exception';

type InvitationWithJoins = Invitation & {
  league: Pick<League, 'name'>;
  invitedBy: Pick<User, 'email'>;
};

@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Owner/commissioner side (routes gated by `members:manage`) --------------------------

  /** Create (or reset to PENDING) an invitation for an email. 409 if that email already belongs
   *  to the owner or a member. The invitee need not have an account yet. */
  async create(
    leagueId: string,
    email: string,
    role: MemberRole | undefined,
    invitedById: string,
  ): Promise<InvitationDto> {
    const trimmed = email?.trim();
    if (!trimmed) {
      throw new DomainException(400, 'BAD_REQUEST', 'email is required');
    }
    const assignedRole = this.validateRole(role ?? 'VIEWER');

    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { ownerId: true },
    });
    if (!league) {
      throw new DomainException(404, 'NOT_FOUND', 'League not found');
    }

    // If the email already has an account, make sure they aren't already in the league.
    const existingUser = await this.prisma.user.findUnique({ where: { email: trimmed } });
    if (existingUser) {
      if (existingUser.id === league.ownerId) {
        throw new DomainException(409, 'CONFLICT', 'The owner is already in the league');
      }
      const member = await this.prisma.leagueMember.findUnique({
        where: { leagueId_userId: { leagueId, userId: existingUser.id } },
      });
      if (member) {
        throw new DomainException(409, 'CONFLICT', 'That user is already a member');
      }
    }

    const invitation = await this.prisma.invitation.upsert({
      where: { leagueId_email: { leagueId, email: trimmed } },
      update: { role: assignedRole, status: 'PENDING', invitedById, respondedAt: null },
      create: { leagueId, email: trimmed, role: assignedRole, invitedById },
      include: { league: { select: { name: true } }, invitedBy: { select: { email: true } } },
    });
    return this.toDto(invitation);
  }

  /** The league's still-open invitations. */
  async listForLeague(leagueId: string): Promise<InvitationDto[]> {
    const invitations = await this.prisma.invitation.findMany({
      where: { leagueId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: { league: { select: { name: true } }, invitedBy: { select: { email: true } } },
    });
    return invitations.map((i) => this.toDto(i));
  }

  async revoke(leagueId: string, invitationId: string): Promise<void> {
    // Scope the delete to the league so an id from elsewhere can't be revoked through this route.
    await this.prisma.invitation.deleteMany({ where: { id: invitationId, leagueId } });
  }

  // ---- Invitee inbox (authorized by email ownership, not a league role) --------------------

  /** The caller's own pending invitations, matched by their account email. */
  async listForUser(userId: string): Promise<InvitationDto[]> {
    const email = await this.callerEmail(userId);
    const invitations = await this.prisma.invitation.findMany({
      where: { email, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: { league: { select: { name: true } }, invitedBy: { select: { email: true } } },
    });
    return invitations.map((i) => this.toDto(i));
  }

  /** Accept an invitation addressed to the caller's email: join the league with the invited
   *  role. 404 if the invitation is not the caller's (don't disclose others'); 409 if answered. */
  async accept(invitationId: string, userId: string): Promise<{ leagueId: string }> {
    const { invitation } = await this.loadOwnInvitation(invitationId, userId);
    if (invitation.status !== 'PENDING') {
      throw new DomainException(409, 'CONFLICT', 'This invitation has already been answered');
    }

    await this.prisma.$transaction([
      this.prisma.leagueMember.upsert({
        where: { leagueId_userId: { leagueId: invitation.leagueId, userId } },
        update: { role: invitation.role },
        create: { leagueId: invitation.leagueId, userId, role: invitation.role },
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      }),
    ]);
    return { leagueId: invitation.leagueId };
  }

  async decline(invitationId: string, userId: string): Promise<void> {
    const { invitation } = await this.loadOwnInvitation(invitationId, userId);
    if (invitation.status !== 'PENDING') {
      throw new DomainException(409, 'CONFLICT', 'This invitation has already been answered');
    }
    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });
  }

  // ---- helpers -----------------------------------------------------------------------------

  private async loadOwnInvitation(invitationId: string, userId: string) {
    const email = await this.callerEmail(userId);
    const invitation = await this.prisma.invitation.findUnique({ where: { id: invitationId } });
    // 404, not 403: never reveal that someone else's invitation exists.
    if (!invitation || invitation.email !== email) {
      throw new DomainException(404, 'NOT_FOUND', 'Invitation not found');
    }
    return { invitation, email };
  }

  private async callerEmail(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) {
      throw new DomainException(404, 'NOT_FOUND', 'User not found');
    }
    return user.email;
  }

  private validateRole(role: unknown): MemberRole {
    if (!(MEMBER_ROLES as readonly string[]).includes(role as string)) {
      throw new DomainException(400, 'BAD_REQUEST', `role must be one of ${MEMBER_ROLES.join(', ')}`);
    }
    return role as MemberRole;
  }

  private toDto(i: InvitationWithJoins): InvitationDto {
    return {
      id: i.id,
      leagueId: i.leagueId,
      leagueName: i.league.name,
      email: i.email,
      role: i.role as MemberRole,
      status: i.status,
      invitedByEmail: i.invitedBy.email,
      createdAt: i.createdAt.toISOString(),
    };
  }
}
