import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** API JSON error body: a code only, never display prose. */
export type ApiErrorBody = {
  code: string;
};

export const ErrorCodes = {
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  invalidOrigin: 'invalid_origin',
  notFound: 'not_found',
  internalError: 'internal_error',
} as const;

export function jsonError(c: Context, status: ContentfulStatusCode, code: string): Response {
  return c.json({ code } satisfies ApiErrorBody, status);
}
