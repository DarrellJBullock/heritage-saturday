// Central place for environment-derived config. Keeping this as a single
// source of truth makes the "dev auth seam" easy to find and replace later.

/**
 * The API lives at a different address depending on who is asking.
 *
 * The browser always reaches it over the host's published port, so
 * NEXT_PUBLIC_API_URL is baked into the client bundle at build time.
 *
 * Server Components fetch it from wherever Next itself is running. On the host
 * that is the same localhost. Inside the `web` container it is NOT: `localhost`
 * there is the container. `API_URL` overrides the base for server-side fetches
 * only — docker-compose sets it to host.docker.internal so SSR can reach the API
 * still running on the host. It is deliberately not NEXT_PUBLIC_*: a
 * container-internal hostname must never be baked into the client bundle.
 *
 * Both default to localhost:3001, so running everything on the host needs no env
 * at all.
 */
const isServer = typeof window === 'undefined';

export const API_BASE_URL = isServer
  ? process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  : process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * AUTH SEAM — NOT real auth.
 *
 * apps/api's AuthStubMiddleware trusts an `x-user-id` request header to
 * resolve `req.user.id` (see apps/api/src/common/auth/auth-stub.middleware.ts).
 * There is no login flow yet, so we hardcode/select a dev user id here and
 * attach it to every request in `apiClient` below.
 *
 * TODO(platform-auth): once real session/JWT auth exists, replace this
 * constant with the authenticated user's id (e.g. from a session hook) —
 * `apiClient` already reads it from one place, so no other file changes.
 */
export const DEV_USER_ID =
  process.env.NEXT_PUBLIC_DEV_USER_ID ?? 'dev-user-1';
