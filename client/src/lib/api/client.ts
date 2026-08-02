import { ApiRequestError, ForbiddenError, UnauthorizedError, isApiErrorBody } from './errors.js';

export { ApiRequestError, ForbiddenError, UnauthorizedError, isApiErrorBody };
export type { ApiErrorBody } from './errors.js';

const ACCEPT_JSON = 'application/json';

async function readErrorBody(response: Response): Promise<string | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (isApiErrorBody(parsed)) {
      return parsed.code;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Shared fetch for every client API call.
 * Always sends Accept: application/json; never call global fetch from components.
 */
export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', ACCEPT_JSON);

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    throw new UnauthorizedError(response.headers.get('Location'));
  }

  if (response.status === 403) {
    const code = await readErrorBody(response);
    throw new ForbiddenError(code);
  }

  if (!response.ok) {
    const code = await readErrorBody(response);
    throw new ApiRequestError(response.status, code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiRequestError(response.status, null, 'invalid_json');
  }
}
