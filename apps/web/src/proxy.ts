import { auth } from '@/auth';

/**
 * Next's request interceptor (formerly `middleware.ts` — Next 16 renamed the convention to
 * `proxy.ts`). Do not confuse it with `app/api/proxy/[...path]`, which is our API proxy route;
 * the collision is Next's naming, not ours.
 *
 * Every page requires a session; unauthenticated visitors are redirected to /signin. The
 * redirect comes from the `authorized` callback in auth.ts — this bare `export default auth`
 * would otherwise let every request through, since Auth.js defaults to authorized.
 *
 * This is defence in depth, not the security boundary. Real enforcement lives in
 * `app/api/proxy/[...path]`, which 401s without a session, and in apps/api, which never
 * receives a user id this app did not assert. This only spares signed-out users a broken page.
 */
export default auth;

export const config = {
  // Skip Auth.js's own endpoints (they must stay reachable while signed out), the API proxy
  // route (it returns a 401 JSON body rather than an HTML redirect, which its fetch() callers
  // can actually handle), and static assets.
  matcher: ['/((?!api/auth|api/proxy|signin|_next/static|_next/image|favicon.ico).*)'],
};
