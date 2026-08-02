import type { Severity } from '@dashboard/shared';
import { m } from '$lib/paraglide/messages.js';

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

/** Accessible label for the per-alert dismiss control. */
export function alertDismissLabel(): string {
  return m.alert_dismiss();
}
