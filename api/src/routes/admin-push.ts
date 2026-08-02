import type { PushResult, PushSend } from '@dashboard/shared';
import type { Context } from 'hono';

import { getDb } from '../db/index.js';
import { ErrorCodes, jsonError } from '../errors.js';
import { dispatchPush, type DispatchPushOptions } from '../push/dispatch.js';
import { pushSendBodySchema } from '../push/send-validation.js';
import type { AppVariables } from '../types.js';

type PushEnv = { Variables: AppVariables };

async function readJsonBody(c: Context<PushEnv>): Promise<unknown | Response> {
  try {
    return await c.req.json();
  } catch {
    return jsonError(c, 400, ErrorCodes.invalidBody);
  }
}

export type AdminPushHandlerOptions = DispatchPushOptions;

/**
 * POST /api/admin/push — validate PushSend, dispatch once per distinct endpoint,
 * return PushResult counts. Never stores or logs the send content.
 */
export function adminPushHandler(
  groups: readonly string[],
  options: AdminPushHandlerOptions = {},
): (c: Context<PushEnv>) => Promise<Response> {
  const schema = pushSendBodySchema(groups);

  return async (c) => {
    const raw = await readJsonBody(c);
    if (raw instanceof Response) {
      return raw;
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(c, 400, ErrorCodes.invalidBody);
    }

    const payload: PushSend = parsed.data;
    const result: PushResult = await dispatchPush(getDb(), payload, options);
    return c.json(result);
  };
}
