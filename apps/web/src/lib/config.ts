// Central place for environment-derived config. Keeping this as a single
// source of truth makes the "dev auth seam" easy to find and replace later.

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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
