import type { Severity } from '@dashboard/shared';
import { m } from '$lib/paraglide/messages.js';

/** Severity members matching the shared Severity union — never a free-form string. */
export const SEVERITIES = ['info', 'success', 'warning', 'error'] as const satisfies readonly Severity[];

/** Accessible / visible name for a severity value from the Paraglide catalog. */
export function severityLabel(severity: Severity): string {
  switch (severity) {
    case 'info':
      return m.severity_info();
    case 'success':
      return m.severity_success();
    case 'warning':
      return m.severity_warning();
    case 'error':
      return m.severity_error();
  }
}

/**
 * Resolve an API error `code` to catalog copy.
 * Never surface raw response prose — the API returns codes only (TDD i18n).
 */
export function resolveApiErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case 'invalid_body':
      return m.error_invalid_body();
    case 'not_found':
      return m.error_not_found();
    default:
      return m.error_request_failed();
  }
}
