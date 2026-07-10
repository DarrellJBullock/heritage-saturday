import { NextRequest } from 'next/server';

/**
 * Server-side proxy to apps/api.
 *
 * The API's auth is a stub: it trusts an `x-user-id` header, so whoever can reach it can be
 * anyone. On a public deployment it is therefore locked behind `API_SHARED_SECRET`. That
 * secret must never reach the browser, so the browser cannot call the API directly — it
 * calls this route on the same origin, and this route adds the secret server-side.
 *
 * Server Components skip this entirely and call the API directly (see lib/config.ts): they
 * already run on the server and can hold the secret themselves.
 */

const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const API_SHARED_SECRET = process.env.API_SHARED_SECRET;
const DEV_USER_ID = process.env.NEXT_PUBLIC_DEV_USER_ID ?? 'dev-user-1';

// Hop-by-hop and length headers must not be forwarded verbatim: the body is re-encoded here,
// so a stale content-length would corrupt the upstream request.
const STRIPPED = new Set(['host', 'connection', 'content-length', 'transfer-encoding']);

async function forward(request: NextRequest, path: string[]): Promise<Response> {
  const search = request.nextUrl.search;
  const target = `${API_URL}/${path.join('/')}${search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIPPED.has(key.toLowerCase())) headers.set(key, value);
  });

  // The identity the API will trust. Today it is a fixed dev user; when real auth lands this
  // is where the authenticated session's user id belongs — one line, one place.
  headers.set('x-user-id', DEV_USER_ID);
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
