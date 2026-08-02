import type { Alert } from '@dashboard/shared';
import type { Context } from 'hono';

import {
  createAlertBodySchema,
  deleteAlert,
  insertAlert,
  listAlerts,
  patchAlertBodySchema,
  toAlert,
  updateAlert,
} from '../alerts/index.js';
import { getDb } from '../db/index.js';
import { ErrorCodes, jsonError } from '../errors.js';
import type { AppVariables } from '../types.js';

type AlertEnv = { Variables: AppVariables };

async function readJsonBody(c: Context<AlertEnv>): Promise<unknown | Response> {
  try {
    return await c.req.json();
  } catch {
    return jsonError(c, 400, ErrorCodes.invalidBody);
  }
}

/** GET /api/admin/alerts — every alert including expired, as Alert[]. */
export function adminListAlertsHandler(): (c: Context<AlertEnv>) => Response {
  return (c) => {
    const alerts: Alert[] = listAlerts(getDb()).map(toAlert);
    return c.json(alerts);
  };
}

/** POST /api/admin/alerts — create; created_by from Remote-User only. */
export function adminCreateAlertHandler(
  groups: readonly string[],
): (c: Context<AlertEnv>) => Promise<Response> {
  const schema = createAlertBodySchema(groups);

  return async (c) => {
    const raw = await readJsonBody(c);
    if (raw instanceof Response) {
      return raw;
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(c, 400, ErrorCodes.invalidBody);
    }

    const identity = c.get('identity');
    const record = insertAlert(getDb(), {
      severity: parsed.data.severity,
      title: parsed.data.title,
      body: parsed.data.body ?? null,
      topic: parsed.data.topic,
      endsAt: parsed.data.endsAt ?? null,
      createdBy: identity.user,
    });

    return c.json(toAlert(record), 201);
  };
}

/** PATCH /api/admin/alerts/:id — partial update; 404 when unknown. */
export function adminPatchAlertHandler(
  groups: readonly string[],
): (c: Context<AlertEnv>) => Promise<Response> {
  const schema = patchAlertBodySchema(groups);

  return async (c) => {
    const raw = await readJsonBody(c);
    if (raw instanceof Response) {
      return raw;
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(c, 400, ErrorCodes.invalidBody);
    }

    const id = c.req.param('id');
    if (!id) {
      return jsonError(c, 404, ErrorCodes.notFound);
    }

    const updated = updateAlert(getDb(), id, parsed.data);
    if (!updated) {
      return jsonError(c, 404, ErrorCodes.notFound);
    }

    return c.json(toAlert(updated));
  };
}

/** DELETE /api/admin/alerts/:id — 404 when unknown. */
export function adminDeleteAlertHandler(): (c: Context<AlertEnv>) => Response {
  return (c) => {
    const id = c.req.param('id');
    if (!id || !deleteAlert(getDb(), id)) {
      return jsonError(c, 404, ErrorCodes.notFound);
    }
    return c.body(null, 204);
  };
}
