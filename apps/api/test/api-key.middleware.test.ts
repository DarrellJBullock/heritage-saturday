import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { Request, Response } from 'express';
import { ApiKeyMiddleware, assertApiKeyConfig } from '../src/common/auth/api-key.middleware';

/**
 * The API's real auth is a stub that trusts an `x-user-id` header, so ApiKeyMiddleware is
 * the only thing standing between a public URL and "any caller can be any user". Its two
 * jobs are tested here: refuse to boot unprotected in production, and reject callers who
 * do not present the secret.
 */

const ENV_KEYS = ['API_SHARED_SECRET', 'ALLOW_INSECURE_NO_API_KEY', 'NODE_ENV'] as const;
const ORIGINAL = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

function setEnv(env: Partial<Record<(typeof ENV_KEYS)[number], string>>): void {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

/** Silences the intentional dev-mode warning so test output stays readable. */
function withoutWarnings<T>(fn: () => T): T {
  const warn = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = warn;
  }
}

describe('assertApiKeyConfig — fail closed at boot', () => {
  it('refuses to start in production without a secret', () => {
    setEnv({ NODE_ENV: 'production' });
    assert.throws(() => assertApiKeyConfig(), /Refusing to start/);
  });

  it('treats an empty-string secret as no secret', () => {
    setEnv({ NODE_ENV: 'production', API_SHARED_SECRET: '' });
    assert.throws(() => assertApiKeyConfig(), /Refusing to start/);
  });

  it('only accepts the exact opt-out string "true"', () => {
    setEnv({ NODE_ENV: 'production', ALLOW_INSECURE_NO_API_KEY: '1' });
    assert.throws(() => assertApiKeyConfig(), /Refusing to start/);
  });

  it('starts in production without a secret when the opt-out is explicit', () => {
    setEnv({ NODE_ENV: 'production', ALLOW_INSECURE_NO_API_KEY: 'true' });
    withoutWarnings(() => assert.doesNotThrow(() => assertApiKeyConfig()));
  });

  it('starts in production with a secret', () => {
    setEnv({ NODE_ENV: 'production', API_SHARED_SECRET: 's3cret' });
    assert.doesNotThrow(() => assertApiKeyConfig());
  });

  it('warns but starts outside production without a secret', () => {
    setEnv({ NODE_ENV: 'development' });
    let warned = '';
    const warn = console.warn;
    console.warn = (msg: string) => {
      warned = msg;
    };
    try {
      assert.doesNotThrow(() => assertApiKeyConfig());
    } finally {
      console.warn = warn;
    }
    assert.match(warned, /unauthenticated/i);
  });
});

describe('ApiKeyMiddleware — reject callers without the secret', () => {
  const middleware = new ApiKeyMiddleware();
  const res = {} as Response;

  /** Returns 'next' if the request was allowed through, or the thrown HTTP status. */
  function call(headers: Record<string, string>): 'next' | number {
    const req = { header: (name: string) => headers[name.toLowerCase()] } as Request;
    let passed = false;
    try {
      middleware.use(req, res, () => {
        passed = true;
      });
    } catch (error) {
      return (error as { getStatus(): number }).getStatus();
    }
    assert.ok(passed, 'middleware neither threw nor called next()');
    return 'next';
  }

  it('allows a request presenting the correct key', () => {
    setEnv({ API_SHARED_SECRET: 's3cret' });
    assert.equal(call({ 'x-api-key': 's3cret' }), 'next');
  });

  it('rejects a missing, wrong, or empty key with 401', () => {
    setEnv({ API_SHARED_SECRET: 's3cret' });
    assert.equal(call({}), 401);
    assert.equal(call({ 'x-api-key': 'wrong' }), 401);
    assert.equal(call({ 'x-api-key': '' }), 401);
  });

  it('rejects keys of any length with 401, never a crash', () => {
    setEnv({ API_SHARED_SECRET: 's3cret' });
    // The comparison is constant-time. node:crypto's timingSafeEqual throws on buffers of
    // unequal size, so a length-mismatched guess must still come back as a clean 401 —
    // a 500 here would mean the digest indirection was dropped.
    assert.equal(call({ 'x-api-key': 's' }), 401);
    assert.equal(call({ 'x-api-key': 's3cret-and-then-some' }), 401);
    assert.equal(call({ 'x-api-key': 's3cre' }), 401); // prefix of the secret
    assert.equal(call({ 'x-api-key': 'S3CRET' }), 401); // same length, wrong case
  });

  it('rejects a forged identity that carries no key — the attack this exists to stop', () => {
    setEnv({ API_SHARED_SECRET: 's3cret' });
    assert.equal(call({ 'x-user-id': 'dev-user-1' }), 401);
  });

  it('is open when no secret is set, which only boot-time config can allow', () => {
    setEnv({ NODE_ENV: 'development' });
    assert.equal(call({}), 'next');
  });
});
