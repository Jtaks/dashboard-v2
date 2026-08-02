import { randomUUID } from 'node:crypto';
import type { Alert, Severity } from '@dashboard/shared';
import type Database from 'better-sqlite3';

/** Full alerts row including authorship (not part of the shared Alert shape). */
export type AlertRecord = {
  id: string;
  severity: Severity;
  title: string;
  body: string | null;
  topic: string;
  endsAt: string | null;
  createdAt: string;
  createdBy: string;
};

export type InsertAlertInput = {
  severity: Severity;
  title: string;
  body: string | null;
  topic: string;
  endsAt: string | null;
  createdBy: string;
};

export type UpdateAlertInput = {
  severity?: Severity | undefined;
  title?: string | undefined;
  body?: string | null | undefined;
  topic?: string | undefined;
  endsAt?: string | null | undefined;
};

type AlertRow = {
  id: string;
  severity: string;
  title: string;
  body: string | null;
  topic: string;
  ends_at: string | null;
  created_at: string;
  created_by: string;
};

function rowToRecord(row: AlertRow): AlertRecord {
  return {
    id: row.id,
    severity: row.severity as Severity,
    title: row.title,
    body: row.body,
    topic: row.topic,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/** Map a stored record to the shared Alert response shape (no created_by). */
export function toAlert(record: AlertRecord): Alert {
  return {
    id: record.id,
    severity: record.severity,
    title: record.title,
    body: record.body,
    topic: record.topic,
    endsAt: record.endsAt,
    createdAt: record.createdAt,
  };
}

/** Insert a row with a generated uuid id and ISO 8601 created_at. */
export function insertAlert(db: Database.Database, input: InsertAlertInput): AlertRecord {
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO alerts (id, severity, title, body, topic, ends_at, created_at, created_by)
     VALUES (@id, @severity, @title, @body, @topic, @ends_at, @created_at, @created_by)`,
  ).run({
    id,
    severity: input.severity,
    title: input.title,
    body: input.body,
    topic: input.topic,
    ends_at: input.endsAt,
    created_at: createdAt,
    created_by: input.createdBy,
  });

  return {
    id,
    severity: input.severity,
    title: input.title,
    body: input.body,
    topic: input.topic,
    endsAt: input.endsAt,
    createdAt,
    createdBy: input.createdBy,
  };
}

/** List every alert row, including expired ones. */
export function listAlerts(db: Database.Database): AlertRecord[] {
  const rows = db
    .prepare(
      `SELECT id, severity, title, body, topic, ends_at, created_at, created_by
       FROM alerts
       ORDER BY created_at DESC`,
    )
    .all() as AlertRow[];

  return rows.map(rowToRecord);
}

/** Fetch one alert by id, or undefined when missing. */
export function getAlertById(db: Database.Database, id: string): AlertRecord | undefined {
  const row = db
    .prepare(
      `SELECT id, severity, title, body, topic, ends_at, created_at, created_by
       FROM alerts
       WHERE id = ?`,
    )
    .get(id) as AlertRow | undefined;

  return row ? rowToRecord(row) : undefined;
}

/**
 * Apply a partial update by id. Leaves created_at and created_by untouched.
 * Returns the updated record, or undefined when the id is unknown.
 */
export function updateAlert(
  db: Database.Database,
  id: string,
  patch: UpdateAlertInput,
): AlertRecord | undefined {
  const existing = getAlertById(db, id);
  if (!existing) {
    return undefined;
  }

  const next: AlertRecord = {
    ...existing,
    severity: patch.severity ?? existing.severity,
    title: patch.title ?? existing.title,
    body: patch.body !== undefined ? patch.body : existing.body,
    topic: patch.topic ?? existing.topic,
    endsAt: patch.endsAt !== undefined ? patch.endsAt : existing.endsAt,
  };

  db.prepare(
    `UPDATE alerts
     SET severity = @severity,
         title = @title,
         body = @body,
         topic = @topic,
         ends_at = @ends_at
     WHERE id = @id`,
  ).run({
    id,
    severity: next.severity,
    title: next.title,
    body: next.body,
    topic: next.topic,
    ends_at: next.endsAt,
  });

  return next;
}

/** Delete by id. Returns true when a row was removed. */
export function deleteAlert(db: Database.Database, id: string): boolean {
  const result = db.prepare(`DELETE FROM alerts WHERE id = ?`).run(id);
  return result.changes > 0;
}
