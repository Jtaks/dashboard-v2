/** API JSON error body: a code only, never display prose. */
export type ApiErrorBody = {
  code: string;
};

export class UnauthorizedError extends Error {
  readonly status = 401 as const;
  readonly location: string | null;

  constructor(location: string | null) {
    super('unauthorized');
    this.name = 'UnauthorizedError';
    this.location = location;
  }
}

export class ForbiddenError extends Error {
  readonly status = 403 as const;
  readonly code: string | null;

  constructor(code: string | null) {
    super('forbidden');
    this.name = 'ForbiddenError';
    this.code = code;
  }
}

/** Non-auth failure, including non-JSON bodies that must not crash parsing. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null, message = 'request_failed') {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as ApiErrorBody).code === 'string'
  );
}
