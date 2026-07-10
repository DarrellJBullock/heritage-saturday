import type { ApiErrorShape, DomainErrorCode } from '@heritage-saturday/shared';
import { API_BASE_URL } from './config';

/**
 * Typed error thrown by `apiClient` for any non-2xx response. Wraps the
 * shared error envelope `{ statusCode, error, message, detail? }` (see
 * company-docs/architecture.md §8) so callers can switch on `body.error`
 * (a `DomainErrorCode`) rather than parsing `message` strings.
 *
 * Known ambiguity (flagged by Backend): for `UNSUPPORTED_FILE_FORMAT` (422),
 * the human-readable top-level parse failure text lives at
 * `body.detail?.topLevelError`, not in `body.message` alone. Callers that
 * care about that specific message should read `detail.topLevelError`.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly errorCode: DomainErrorCode | string;
  readonly detail?: Record<string, unknown>;

  constructor(body: ApiErrorShape) {
    super(body.message);
    this.name = 'ApiError';
    this.statusCode = body.statusCode;
    this.errorCode = body.error;
    this.detail = body.detail;
  }

  /** Convenience accessor for the 422 unsupported-file-format case. */
  get topLevelError(): string | undefined {
    const value = this.detail?.topLevelError;
    return typeof value === 'string' ? value : undefined;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: BodyInit;
  headers?: Record<string, string>;
  /** Skip setting Content-Type: application/json (e.g. for multipart uploads). */
  isFormData?: boolean;
}

/**
 * Sends no identity and no secret of its own.
 *
 * In the browser `API_BASE_URL` is `/api/proxy`, and that route attaches both `x-api-key` and
 * the session's `x-user-id` server-side — a client-sent `x-user-id` would be overwritten
 * anyway, so sending one would only imply it mattered. Server-side callers must supply both
 * via `options.headers`; use `lib/api-client.server.ts`, which does it from the session.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...options.headers };
  if (!options.isFormData && options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body,
      cache: 'no-store',
    });
  } catch (cause) {
    throw new ApiError({
      statusCode: 0,
      error: 'NETWORK_ERROR',
      message: 'Could not reach the Heritage Saturday API. Is it running?',
      detail: { cause: String(cause) },
    });
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const body = json as Partial<ApiErrorShape> | undefined;
    throw new ApiError({
      statusCode: body?.statusCode ?? res.status,
      error: body?.error ?? 'UNKNOWN_ERROR',
      message: body?.message ?? res.statusText,
      detail: body?.detail,
    });
  }

  return json as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form, isFormData: true }),
};
