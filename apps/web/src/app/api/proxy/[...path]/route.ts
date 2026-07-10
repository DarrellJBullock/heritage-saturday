import { NextRequest } from 'next/server';
import { auth } from '@/auth';

/**
 * Server-side proxy to apps/api — the browser's only path to the API.
 *
 * apps/api trusts an `x-user-id` header, so whoever can reach it can be anyone. It is
 * therefore locked behind `API_SHARED_SECRET`, which must never reach the browser. This route
 * is where the two halves meet: it authenticates the *caller* to the API with the secret, and
 * asserts the *user* from this app's session.
 *
 * Both headers are set here and neither is taken from the incoming request, so a browser can
 * neither borrow the secret nor claim another user's id.
 *
 * Server Components skip this entirely and call the API directly (lib/api-client.server.ts):
 * they already run on the server and can hold the secret themselves.
 */

const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const API_SHARED_SECRET = process.env.API_SHARED_SECRET;

// Hop-by-hop and length headers must not be forwarded verbatim: the body is re-encoded here,
// so a stale content-length would corrupt the upstream request.
//
// `x-user-id` and `x-api-key` are stripped on the way in and re-set below from the session and
// the environment. Stripping is not redundant with the `set()` calls: `x-api-key` is only set
// when API_SHARED_SECRET is configured, so without this a browser-supplied key would be
// forwarded verbatim whenever the secret is unset — which is exactly how local dev and the e2e
// job run. Strip unconditionally so the guarantee does not depend on configuration.
const STRIPPED = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'x-user-id',
  'x-api-key',
]);

async function forward(request: NextRequest, path: string[]): Promise<Response> {
  // No session, no proxying. Returning JSON rather than redirecting matters: every caller here
  // is a fetch() from a client component, and an HTML redirect would surface as a parse error.
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json(
      { statusCode: 401, error: 'UNAUTHENTICATED', message: 'Not signed in.' },
      { status: 401 },
    );
  }

  const search = request.nextUrl.search;
  const target = `${API_URL}/${path.join('/')}${search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIPPED.has(key.toLowerCase())) headers.set(key, value);
  });

  // Set, never forwarded: these overwrite whatever the browser sent, which is what stops a
  // client from claiming another user's id or supplying its own key.
  headers.set('x-user-id', userId);
  if (API_SHARED_SECRET) headers.set('x-api-key', API_SHARED_SECRET);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      // Buffer rather than stream: uploads here are roster files (small), and buffering keeps
      // this compatible with runtimes that do not support duplex request streaming.
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: 'no-store',
    });
  } catch (cause) {
    return Response.json(
      {
        statusCode: 0,
        error: 'NETWORK_ERROR',
        message: 'Could not reach the Heritage Saturday API.',
        detail: { cause: String(cause) },
      },
      { status: 502 },
    );
  }

  const body = await upstream.arrayBuffer();
  const responseHeaders = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) responseHeaders.set('content-type', contentType);

  return new Response(body.byteLength ? body : null, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function PATCH(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
