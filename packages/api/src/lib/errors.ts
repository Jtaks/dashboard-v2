export type ApiErrorBody = { code: string };

export const ERROR_CODES = {
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  notFound: 'not_found',
  badRequest: 'bad_request',
  originMismatch: 'origin_mismatch',
  internal: 'internal_error',
} as const;
