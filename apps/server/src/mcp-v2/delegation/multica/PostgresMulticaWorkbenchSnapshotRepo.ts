import type { PgPool } from "../../../db/postgres.js";
import type { MulticaSyncState, MulticaWorkbenchSnapshot, MulticaWorkbenchSnapshotRepo } from "./MulticaWorkbenchSnapshotRepo.js";

interface SnapshotRow { rich_project_id: string; snapshot_key: string; payload_json: unknown; updated_at: string }
interface SyncRow { rich_project_id: string; status: MulticaSyncState["status"]; last_attempt_at: string | null; last_success_at: string | null; error: string | null }

export class PostgresMulticaWorkbenchSnapshotRepo implements MulticaWorkbenchSnapshotRepo {
  constructor(private readonly pg: PgPool) {}

  async get<T>(richProjectId: string, key: string): Promise<MulticaWorkbenchSnapshot<T> | null> {
    await this.pg.ready;
    const result = await this.pg.query<SnapshotRow>(`SELECT rich_project_id, snapshot_key, payload_json, updated_at
      FROM multica_workbench_snapshots WHERE rich_project_id = $1 AND snapshot_key = $2`, [richProjectId, key]);
    const row = result.rows[0];
    return row ? { richProjectId: row.rich_project_id, key: row.snapshot_key, payload: parseJson(row.payload_json) as T, updatedAt: row.updated_at } : null;
  }

  async save<T>(snapshot: MulticaWorkbenchSnapshot<T>): Promise<void> {
    await this.pg.ready;
    await this.pg.query(`INSERT INTO multica_workbench_snapshots (rich_project_id, snapshot_key, payload_json, updated_at)
      VALUES ($1, $2, $3::jsonb, $4)
      ON CONFLICT(rich_project_id, snapshot_key) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
    [snapshot.richProjectId, snapshot.key, JSON.stringify(snapshot.payload), snapshot.updatedAt]);
  }

  async deleteByPrefixes(richProjectId: string, prefixes: string[]): Promise<void> {
    await this.pg.ready;
    if (prefixes.length === 0) return;
    await this.pg.query(`DELETE FROM multica_workbench_snapshots WHERE rich_project_id = $1
      AND snapshot_key LIKE ANY($2::text[])`, [richProjectId, prefixes.map(prefix => `${prefix}%`)]);
  }

  async getSyncState(richProjectId: string): Promise<MulticaSyncState | null> {
    await this.pg.ready;
    const result = await this.pg.query<SyncRow>(`SELECT rich_project_id, status, last_attempt_at, last_success_at, error
      FROM multica_workbench_sync_state WHERE rich_project_id = $1`, [richProjectId]);
    const row = result.rows[0];
    return row ? {
      richProjectId: row.rich_project_id,
      status: row.status,
      ...(row.last_attempt_at ? { lastAttemptAt: row.last_attempt_at } : {}),
      ...(row.last_success_at ? { lastSuccessAt: row.last_success_at } : {}),
      ...(row.error ? { error: row.error } : {}),
    } : null;
  }

  async saveSyncState(state: MulticaSyncState): Promise<void> {
    await this.pg.ready;
    await this.pg.query(`INSERT INTO multica_workbench_sync_state
      (rich_project_id, status, last_attempt_at, last_success_at, error) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT(rich_project_id) DO UPDATE SET status = excluded.status, last_attempt_at = excluded.last_attempt_at,
        last_success_at = excluded.last_success_at, error = excluded.error`,
    [state.richProjectId, state.status, state.lastAttemptAt ?? null, state.lastSuccessAt ?? null, state.error ?? null]);
  }
}

function parseJson(value: unknown): unknown { return typeof value === "string" ? JSON.parse(value) : value; }
