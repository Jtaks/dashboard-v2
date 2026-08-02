import { randomUUID } from 'node:crypto';

import type { Alert, Severity } from '@dashboard/shared';
import type Database from 'better-sqlite3';

import { isVisibleAlert } from './targeting.js';
import type { AlertBody, AlertPatch } from './validation.js';

type AlertRow = {
  id: string;
  severity: Severity;
  title: string;
  body: string | null;
  topic: string;
  ends_at: string | null;
  created_at: string;
  created_by: string;
};

export type StoredAlert = AlertRow;

function rowToAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    severity: row.severity,
    title: row.title,
    body: row.body,
    topic: row.topic,
    endsAt: row.ends_at,
    createdAt: row.created_at,
  };
}

function readRow(row: AlertRow | undefined): StoredAlert | null {
  return row ?? null;
}

export function createAlertsRepository(db: Database.Database) {
  const insertStatement = db.prepare(`
    INSERT INTO alerts (id, severity, title, body, topic, ends_at, created_at, created_by)
    VALUES (@id, @severity, @title, @body, @topic, @ends_at, @created_at, @created_by)
  `);

  const listStatement = db.prepare(`
    SELECT id, severity, title, body, topic, ends_at, created_at, created_by
    FROM alerts
    ORDER BY created_at DESC
  `);

  const getByIdStatement = db.prepare(`
    SELECT id, severity, title, body, topic, ends_at, created_at, created_by
    FROM alerts
    WHERE id = ?
  `);

  const deleteByIdStatement = db.prepare('DELETE FROM alerts WHERE id = ?');

  return {
    insert(alert: AlertBody, createdBy: string): StoredAlert {
      const row: AlertRow = {
        id: randomUUID(),
        severity: alert.severity,
        title: alert.title,
        body: alert.body,
        topic: alert.topic,
        ends_at: alert.endsAt,
        created_at: new Date().toISOString(),
        created_by: createdBy,
      };

      insertStatement.run(row);
      return row;
    },

    listAll(): Alert[] {
      const rows = listStatement.all() as AlertRow[];
      return rows.map(rowToAlert);
    },

    listForGroups(groups: string[], referenceTime = new Date().toISOString()): Alert[] {
      return this.listAll().filter((alert) => isVisibleAlert(alert, groups, referenceTime));
    },

    getById(id: string): StoredAlert | null {
      return readRow(getByIdStatement.get(id) as AlertRow | undefined);
    },

    updateById(id: string, patch: AlertPatch): StoredAlert | null {
      const existing = readRow(getByIdStatement.get(id) as AlertRow | undefined);
      if (!existing) {
        return null;
      }

      const updates: Partial<AlertRow> = {};
      if (patch.severity !== undefined) {
        updates.severity = patch.severity;
      }
      if (patch.title !== undefined) {
        updates.title = patch.title;
      }
      if (patch.body !== undefined) {
        updates.body = patch.body;
      }
      if (patch.topic !== undefined) {
        updates.topic = patch.topic;
      }
      if (patch.endsAt !== undefined) {
        updates.ends_at = patch.endsAt;
      }

      if (Object.keys(updates).length === 0) {
        return existing;
      }

      const assignments = Object.keys(updates)
        .map((column) => `${column} = @${column}`)
        .join(', ');

      db.prepare(`UPDATE alerts SET ${assignments} WHERE id = @id`).run({
        ...updates,
        id,
      });

      return readRow(getByIdStatement.get(id) as AlertRow | undefined);
    },

    deleteById(id: string): boolean {
      const result = deleteByIdStatement.run(id);
      return result.changes > 0;
    },
  };
}

export type AlertsRepository = ReturnType<typeof createAlertsRepository>;
