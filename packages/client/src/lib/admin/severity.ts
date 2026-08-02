import type { Severity } from '@dashboard/shared';

import * as m from '$lib/paraglide/messages';

import { SEVERITIES } from './alerts-form.js';

export { SEVERITIES };

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
