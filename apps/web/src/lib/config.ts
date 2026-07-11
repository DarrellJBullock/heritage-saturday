// Central place for environment-derived config. Keeping this as a single
// source of truth makes the "dev auth seam" easy to find and replace later.

/**
 * The API lives at a different address depending on who is asking.
 *
 * The browser never reaches the API directly — it calls this app's own `/api/proxy/*`
 * route on the same origin. So there is no build-time API address in the client bundle,
 * and no NEXT_PUBLIC_API_URL: a same-origin relative path works from any host.
 *
 * Server Components fetch it from wherever Next itself is running. On the host that is
 * localhost. Inside the `web` container it is NOT: `localhost` there is the container.
 * `API_URL` sets the base for server-side fetches — docker-compose points it at
 * host.docker.internal so SSR can reach an API still running on the host. It is read at
 * runtime and deliberately not NEXT_PUBLIC_*: it is paired with API_SHARED_SECRET, and a
 * container-internal hostname must never be baked into a client bundle either.
 *
 * It defaults to localhost:3001, so running everything on the host needs no env at all.
 */
export const IS_SERVER = typeof window === 'undefined';

/**
 * The browser NEVER calls the API directly. The API's auth stub trusts an `x-user-id`
 * header, so a public deployment gates it behind `API_SHARED_SECRET` — a secret that cannot
 * live in a client bundle. Browser requests go to this app's own `/api/proxy/*` route, which
 * attaches the secret server-side.
 *
 * Server Components already run on the server, so they call the API directly and hold the
 * secret themselves. `API_URL` is read at runtime and is deliberately not NEXT_PUBLIC_*.
 */
// Strip any trailing slash: callers append paths as `${API_BASE_URL}/auth/session`, so a
// value like `https://api.example.com/` would produce a `//auth/session` double slash that
// routes differently from `/auth/session` and breaks every API call. Normalize it once here.
export const API_BASE_URL = IS_SERVER
  ? (process.env.API_URL ?? 'http://localhost:3001').replace(/\/+$/, '')
  : '/api/proxy';

/** Server-only. Never referenced in a browser code path — see api-client's IS_SERVER guard. */
export const API_SHARED_SECRET = IS_SERVER ? process.env.API_SHARED_SECRET : undefined;

/**
 * Identity is no longer a constant.
 *
 * apps/web owns the user session (see src/auth.ts) and asserts the signed-in user's id to the
 * API via `x-user-id`, which apps/api trusts because only a caller holding API_SHARED_SECRET
 * can set it. Server-side callers read the session directly (lib/api-client.server.ts); browser
 * callers never send an identity at all, because /api/proxy attaches it for them.
 */
