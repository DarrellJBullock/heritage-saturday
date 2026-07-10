import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ResolveSessionDto } from './dto/resolve-session.dto';
import { DomainException } from '../common/errors/domain-exception';

/**
 * Internal endpoint, called only by apps/web's Auth.js `jwt` callback — never by a browser.
 *
 * It is the one route with no `x-user-id`: it *establishes* which user is signing in, so it
 * is excluded from TrustedProxyUserMiddleware in app.module.ts. ApiKeyMiddleware still guards
 * it, which is what stops an anonymous caller from minting or hijacking accounts.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('session')
  @HttpCode(HttpStatus.OK) // Resolving an identity is idempotent, not a creation. (§391)
  resolveSession(@Body() dto: ResolveSessionDto): Promise<{ userId: string }> {
    const provider = dto?.provider?.trim();
    const subject = dto?.subject?.trim();
    const email = dto?.email?.trim();

    // No global ValidationPipe in this app; controllers validate and throw DomainException.
    if (!provider || !subject || !email) {
      throw new DomainException(400, 'BAD_REQUEST', 'provider, subject and email are all required');
    }

    return this.authService.resolveSession(provider, subject, email);
  }
}
