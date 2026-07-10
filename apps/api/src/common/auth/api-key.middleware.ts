import { createHash, timingSafeEqual } from 'node:crypto';
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Constant-time string equality.
 *
 * `===` bails on the first differing byte, so how long it takes to reject a guess reveals
 * how much of that guess was right. Comparing SHA-256 digests instead of the raw strings is
 * what makes this safe for inputs of *different* lengths: `timingSafeEqual` throws unless
 * both buffers are the same size, and branching on `a.length !== b.length` would leak the
 * secret's length. Digests are always 32 bytes, so neither the comparison nor the guard
 * depends on the input.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a, 'utf8').digest();
  const digestB = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(digestA, digestB);
}

/**
 * Shared-secret gate in front of AuthStubMiddleware.
 *
 * The stub trusts an `x-user-id` header, which means the *caller* chooses their identity.
 * That is fine on localhost and catastrophic on a public URL: anyone could send
 * `x-user-id: dev-user-1` and read or delete another user's rosters. The ownership guards
 * are only meaningful if the header cannot be forged.
 *
 * Until real auth lands, a public deployment must be reachable only by something that
 * knows `API_SHARED_SECRET`. In practice that is apps/web's server-side proxy — the browser
 * never talks to this API directly, so the secret never reaches a client bundle.
 *
 * FAIL CLOSED: in production, a missing secret is a boot error, not a warning. A forgotten
 * environment variable must not silently publish an open API. Set
 * ALLOW_INSECURE_NO_API_KEY=true to opt out deliberately — the local docker-compose `api`
 * service does, since it is only reachable on a private network. CI does NOT: it runs the
 * containers with a real secret so this gate is exercised the way it ships.
 *
 * TODO(platform-auth): delete this once real session/JWT auth replaces the stub. It is a
 * deployment lock, not an identity system — it authenticates the caller, not the user.
 */
export function assertApiKeyConfig(): void {
  const secret = process.env.API_SHARED_SECRET;
  const allowInsecure = process.env.ALLOW_INSECURE_NO_API_KEY === 'true';
  const isProduction = process.env.NODE_ENV === 'production';

  if (secret) return;

  if (isProduction && !allowInsecure) {
    throw new Error(
      'Refusing to start: NODE_ENV=production without API_SHARED_SECRET. The x-user-id ' +
        'auth stub lets any caller choose their identity, so an unprotected public API is ' +
        'wide open. Set API_SHARED_SECRET, or ALLOW_INSECURE_NO_API_KEY=true to override.',
    );
  }

  // eslint-disable-next-line no-console
  console.warn(
    '[api-key] API_SHARED_SECRET is not set — the API is unauthenticated. Fine for local ' +
      'development; never do this on a reachable host.',
  );
}

@Injectable()
export class ApiKeyMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const secret = process.env.API_SHARED_SECRET;
    if (!secret) {
      next(); // Unset is only reachable when assertApiKeyConfig() allowed it at boot.
      return;
    }

    // Absence is not a secret, so short-circuiting here leaks nothing worth having.
    const provided = req.header('x-api-key');
    if (provided === undefined || !constantTimeEqual(provided, secret)) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'UNAUTHENTICATED',
        message: 'Missing or invalid x-api-key header',
      });
    }
    next();
  }
}
