import { ApiError } from '$lib/api/client.js';
import * as m from '$lib/paraglide/messages';

export function resolvePushApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'bad_request') {
    return m.admin_push_error_validation();
  }

  return m.admin_push_error_generic();
}
