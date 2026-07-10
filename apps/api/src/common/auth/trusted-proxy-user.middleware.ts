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
 * Resolves `req.user.id` from the `x-user-id` header asserted by a trusted caller.
 *
 * This is NOT the stub it used to be. Real authentication happens in apps/web, which owns the
 * user session (Auth.js, Google OIDC). Because apps/web is the only thing that can reach this
 * API — ApiKeyMiddleware runs first and rejects anyone without `API_SHARED_SECRET` — the
 * `x-user-id` it sends is an assertion from an authenticated peer, not a caller-chosen value.
 * That is the backend-for-frontend (BFF) pattern, and it is why the header is trustworthy.
 *
 * The security of every ownership check therefore rests on ApiKeyMiddleware. Read its comment
 * before weakening either one: without it, anyone could send `x-user-id: <victim>` and this
 * middleware would believe them.
 *
 * `POST /auth/session` is excluded (see app.module.ts) — it is what *establishes* the user id,
 * so by definition it cannot already carry one.
 */
@Injectable()
export class TrustedProxyUserMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const userId = req.header('x-user-id');
    if (!userId) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'UNAUTHENTICATED',
        message: 'Missing x-user-id header',
      });
    }
    req.user = { id: userId };
    next();
  }
}
