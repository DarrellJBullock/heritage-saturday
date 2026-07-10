import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { DomainException } from '../common/errors/domain-exception';

/** Prisma's unique-constraint violation. */
const UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Map a provider identity onto an internal `User.id`, creating the row on first sign-in.
   *
   * Idempotent: the same `(provider, subject)` always resolves to the same user, so
   * apps/web can call this on every sign-in without branching on "is this a new account".
   * The email is refreshed on each call because providers let users change it — the subject,
   * not the email, is what identifies the account.
   */
  async resolveSession(provider: string, subject: string, email: string): Promise<{ userId: string }> {
    try {
      const user = await this.prisma.user.upsert({
        where: { authProvider_authSubject: { authProvider: provider, authSubject: subject } },
        update: { email },
        create: { authProvider: provider, authSubject: subject, email },
        select: { id: true },
      });
      return { userId: user.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
        // `email` is unique and some *other* account already holds it. We deliberately do not
        // link the two: silently adopting an existing account because a provider asserted a
        // matching email is an account-takeover vector whenever that email is unverified.
        // The seeded fixture users are the common case here, and they are not meant to be
        // signed into.
        throw new DomainException(
          409,
          'CONFLICT',
          'That email address already belongs to another account.',
          { email },
        );
      }
      throw error;
    }
  }
}
