import type { ApiErrorBody } from './types.js';

const JSON_ACCEPT = 'application/json';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly location: string | null;

  constructor(status: number, code: string | null, location: string | null, message?: string) {
    super(message ?? `API request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.location = location;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}

export class ApiParseError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiParseError';
    this.status = status;
  }
}

async function readErrorBody(response: Response): Promise<string | null> {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes(JSON_ACCEPT)) {
    return null;
  }

  try {
    const body = (await response.json()) as ApiErrorBody;
    return typeof body.code === 'string' ? body.code : null;
  } catch {
    return null;
  }
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', JSON_ACCEPT);

  const response = await fetch(input, { ...init, headers });

  if (response.ok) {
    return response;
  }

  const code = await readErrorBody(response);
  const location = response.status === 401 ? response.headers.get('Location') : null;

  throw new ApiError(response.status, code, location);
}

export async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await apiFetch(input, init);
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes(JSON_ACCEPT)) {
    throw new ApiParseError(
      response.status,
      `Expected ${JSON_ACCEPT} response but received ${contentType || 'no content type'}`,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiParseError(response.status, 'Response body is not valid JSON');
  }
}
