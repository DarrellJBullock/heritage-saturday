import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

export interface RequestUser {
  id: string;
}

declare module 'express' {
  interface Request {
    user?: RequestUser;
  }
}

/**
 * AUTH SEAM — NOT a real auth system.
 *
 * Per company-docs/architecture.md §8: "Assume platform-level auth (session/JWT)
 * already resolves req.user.id." This middleware is a placeholder that trusts an
 * `x-user-id` header to populate req.user, so the rest of the API (OwnershipGuard,
 * services) can be built against a stable req.user.id contract today.
 *
 * TODO(platform-auth): replace this middleware with real session/JWT verification
 * when platform auth lands. No other file should need to change — everything
 * downstream only depends on `req.user.id` being present and trustworthy.
 */
@Injectable()
export class AuthStubMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const userId = req.header('x-user-id');
    if (!userId) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'UNAUTHENTICATED',
        message: 'Missing x-user-id header (auth stub — see AuthStubMiddleware)',
      });
    }
    req.user = { id: userId };
    next();
  }
}
