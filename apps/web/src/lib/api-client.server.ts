import 'server-only';
import { auth } from '@/auth';
import { ApiError, request } from './api-client';
import { API_SHARED_SECRET } from './config';

/**
 * The API client for Server Components, which call apps/api directly rather than through
 * `/api/proxy` (they already run on the server, so a same-origin hop would be pointless).
 *
 * Being a separate module is the point. `auth()` pulls in Auth.js's server internals, and
 * importing it into `api-client.ts` — which client components use — would drag that toward the
 * browser bundle. The `server-only` import turns any such mistake into a build error rather
 * than a leaked secret.
 */
async function authHeaders(): Promise<Record<string, string>> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    // Reached only if a Server Component renders for a signed-out visitor, which the request
    // interceptor (src/proxy.ts) normally prevents. Failing here beats calling the API with
    // no identity.
    throw new ApiError({
      statusCode: 401,
      error: 'UNAUTHENTICATED',
      message: 'Not signed in.',
    });
  }

  const headers: Record<string, string> = { 'x-user-id': userId };
  if (API_SHARED_SECRET) headers['x-api-key'] = API_SHARED_SECRET;
  return headers;
}

export const serverApiClient = {
  get: async <T>(path: string): Promise<T> =>
    request<T>(path, { method: 'GET', headers: await authHeaders() }),
  post: async <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, {
      method: 'POST',
      headers: await authHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
};
