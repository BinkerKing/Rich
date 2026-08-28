import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { MulticaSyncState, MulticaWorkbenchSnapshot, MulticaWorkbenchSnapshotRepo } from "./MulticaWorkbenchSnapshotRepo.js";

interface SnapshotRow { rich_project_id: string; snapshot_key: string; payload_json: string; updated_at: string }
interface SyncRow { rich_project_id: string; status: MulticaSyncState["status"]; last_attempt_at: string | null; last_success_at: string | null; error: string | null }

export class SqliteMulticaWorkbenchSnapshotRepo implements MulticaWorkbenchSnapshotRepo {
  constructor(private readonly db: Database.Database) {}

  close(): void { this.db.close(); }

  get<T>(richProjectId: string, key: string): MulticaWorkbenchSnapshot<T> | null {
    const row = this.db.prepare(`SELECT rich_project_id, snapshot_key, payload_json, updated_at
      FROM multica_workbench_snapshots WHERE rich_project_id = ? AND snapshot_key = ?`)
      .get(richProjectId, key) as SnapshotRow | undefined;
    return row ? { richProjectId: row.rich_project_id, key: row.snapshot_key, payload: JSON.parse(row.payload_json) as T, updatedAt: row.updated_at } : null;
  }

  save<T>(snapshot: MulticaWorkbenchSnapshot<T>): void {
    this.db.prepare(`INSERT INTO multica_workbench_snapshots (rich_project_id, snapshot_key, payload_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(rich_project_id, snapshot_key) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`)
      .run(snapshot.richProjectId, snapshot.key, JSON.stringify(snapshot.payload), snapshot.updatedAt);
  }

  deleteByPrefixes(richProjectId: string, prefixes: string[]): void {
    const remove = this.db.prepare("DELETE FROM multica_workbench_snapshots WHERE rich_project_id = ? AND snapshot_key LIKE ?");
    const transaction = this.db.transaction(() => { for (const prefix of prefixes) remove.run(richProjectId, `${prefix}%`); });
    transaction();
  }

  getSyncState(richProjectId: string): MulticaSyncState | null {
    const row = this.db.prepare(`SELECT rich_project_id, status, last_attempt_at, last_success_at, error
      FROM multica_workbench_sync_state WHERE rich_project_id = ?`).get(richProjectId) as SyncRow | undefined;
    return row ? hydrateSync(row) : null;
  }

  saveSyncState(state: MulticaSyncState): void {
    this.db.prepare(`INSERT INTO multica_workbench_sync_state
      (rich_project_id, status, last_attempt_at, last_success_at, error) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(rich_project_id) DO UPDATE SET status = excluded.status, last_attempt_at = excluded.last_attempt_at,
        last_success_at = excluded.last_success_at, error = excluded.error`)
      .run(state.richProjectId, state.status, state.lastAttemptAt ?? null, state.lastSuccessAt ?? null, state.error ?? null);
  }
}

export function openSqliteMulticaWorkbenchSnapshotRepo(filePath: string): SqliteMulticaWorkbenchSnapshotRepo {
  mkdirSync(dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS multica_workbench_snapshots (
      rich_project_id TEXT NOT NULL,
      snapshot_key TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (rich_project_id, snapshot_key)
    );
    CREATE TABLE IF NOT EXISTS multica_workbench_sync_state (
      rich_project_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      last_attempt_at TEXT,
      last_success_at TEXT,
      error TEXT
    );
  `);
  return new SqliteMulticaWorkbenchSnapshotRepo(db);
}

function hydrateSync(row: SyncRow): MulticaSyncState {
  return {
    richProjectId: row.rich_project_id,
    status: row.status,
    ...(row.last_attempt_at ? { lastAttemptAt: row.last_attempt_at } : {}),
    ...(row.last_success_at ? { lastSuccessAt: row.last_success_at } : {}),
    ...(row.error ? { error: row.error } : {}),
  };
}
