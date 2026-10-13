import type { ApiErrorBody, ApiErrorCode } from '../../shared/types';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_tag: 400,
  not_found: 404,
  rate_limited: 429,
  upstream: 502,
  not_configured: 503,
  offline: 503, // client-side only; never produced here
};

export class ApiHttpError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number = STATUS_BY_CODE[code],
  ) {
    super(message);
    this.name = 'ApiHttpError';
  }
}

export function jsonResponse(body: unknown, status = 200, cacheSeconds?: number): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8' };
  if (cacheSeconds !== undefined) {
    headers['cache-control'] = `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`;
  } else {
    headers['cache-control'] = 'no-store';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiHttpError) {
    const body: ApiErrorBody = { error: err.code, message: err.message };
    return jsonResponse(body, err.status);
  }
  const body: ApiErrorBody = { error: 'upstream', message: 'Unexpected server error.' };
  return jsonResponse(body, 502);
}
