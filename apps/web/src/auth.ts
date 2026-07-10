import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { API_BASE_URL, API_SHARED_SECRET } from './lib/config';

/**
 * The user id of the seeded fixture account (apps/api/prisma/seed.ts). The dev-login provider
 * signs in *as* this row rather than minting an identity, which is why it never calls
 * /auth/session: fixtures deliberately have no `authProvider`/`authSubject`.
 */
export const DEV_LOGIN_USER_ID = 'dev-user-1';

/** Whether the password-less dev-login provider should be registered at all. */
export function devLoginEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_LOGIN === 'true';
}

/**
 * FAIL CLOSED, mirroring assertApiKeyConfig() in apps/api.
 *
 * The dev-login provider signs anyone in as `dev-user-1` with no password. In production that
 * is not a convenience, it is an unauthenticated login endpoint. `devLoginEnabled()` already
 * returns false under NODE_ENV=production, so the provider would silently not register — and
 * silence is the problem: an operator who set ALLOW_DEV_LOGIN=true believing it worked would
 * never learn it didn't, and the same variable on a NODE_ENV-less host WOULD open the hole.
 * Refusing to boot makes the mistake loud.
 */
export function assertDevLoginConfig(): void {
  // `next build` also runs with NODE_ENV=production and loads .env.local — where .env.example
  // tells developers to set ALLOW_DEV_LOGIN=true. A build serves no requests, so throwing here
  // would only make `npm run build` impossible on a dev machine while protecting nothing. The
  // check that matters is this same one at server start, which still runs in the built image.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_LOGIN === 'true') {
    throw new Error(
      'Refusing to start: ALLOW_DEV_LOGIN=true with NODE_ENV=production. Dev login is a ' +
        'password-less sign-in as dev-user-1 and must never be reachable on a deployed host. ' +
        'Unset ALLOW_DEV_LOGIN.',
    );
  }
}

assertDevLoginConfig();

/**
 * Exchange a provider identity for our internal `User.id`.
 *
 * apps/web has no database access — apps/api owns Prisma — so identity is resolved by calling
 * the API's internal endpoint with the shared secret. Idempotent: the same `(provider,
 * subject)` always returns the same id, so this runs on every sign-in without branching.
 */
async function resolveApiUserId(provider: string, subject: string, email: string): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_SHARED_SECRET) headers['x-api-key'] = API_SHARED_SECRET;

  const res = await fetch(`${API_BASE_URL}/auth/session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ provider, subject, email }),
    cache: 'no-store',
  });

  if (!res.ok) {
    // Surfacing the API's message matters: a 409 means the email belongs to another account,
    // which is a user-facing condition, not a bug.
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(`Could not resolve user (${res.status}): ${body?.message ?? res.statusText}`);
  }

  const { userId } = (await res.json()) as { userId: string };
  return userId;
}

const providers: NextAuthConfig['providers'] = [Google];

if (devLoginEnabled()) {
  providers.push(
    Credentials({
      id: 'dev-login',
      name: 'Development login',
      credentials: {},
      // No password check by design — see assertDevLoginConfig() for why this cannot ship.
      authorize: () => ({ id: DEV_LOGIN_USER_ID, email: 'dev@heritage-saturday.local' }),
    }),
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  // JWT, not a database session: apps/api is the sole owner of Prisma, and a database adapter
  // here would hand apps/web its own DB connection. The cookie stays opaque to the API — the
  // proxy translates it into `x-user-id` rather than forwarding it.
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin' },
  callbacks: {
    // Consulted only by the request interceptor (src/proxy.ts). Returning false is what makes
    // Auth.js redirect to `pages.signIn` — without this callback it defaults to *authorized*,
    // so `export default auth` would populate the session and let every request through.
    authorized: ({ auth }) => Boolean(auth?.user?.id),

    async jwt({ token, account, profile }) {
      // `account` is only present on the sign-in request, so the API is called once per login,
      // not on every session read.
      if (account?.provider === 'google') {
        const subject = profile?.sub;
        const email = profile?.email;
        if (!subject || !email) throw new Error('Google returned no subject or email');
        token.userId = await resolveApiUserId('google', subject, email);
      } else if (account?.provider === 'dev-login') {
        token.userId = DEV_LOGIN_USER_ID;
      }
      return token;
    },
    session({ session, token }) {
      // Everything downstream (the proxy, Server Components) reads session.user.id.
      if (token.userId) session.user.id = token.userId;
      return session;
    },
  },
});
