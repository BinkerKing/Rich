import type { ElementId } from "@ke/domain";
import type { PgPool } from "../db/postgres.js";
import type { CenterChange, StateRepo } from "./StateRepo.js";

const CURRENT_KEY = "center.current";

export class PostgresStateRepo implements StateRepo {
  constructor(private pool: PgPool) {}

  async getCenter(): Promise<{ elementId: ElementId | null; updatedAt: string | null }> {
    const { rows } = await this.pool.query<{ value: string; updated_at: string }>(
      "SELECT value, updated_at FROM state WHERE key = $1",
      [CURRENT_KEY],
    );
    if (!rows[0]) return { elementId: null, updatedAt: null };
    return { elementId: rows[0].value || null, updatedAt: rows[0].updated_at };
  }

  async setCenter(elementId: ElementId): Promise<CenterChange> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const priorRows = await client.query<{ value: string; updated_at: string }>(
        "SELECT value, updated_at FROM state WHERE key = $1",
        [CURRENT_KEY],
      );
      const prior = priorRows.rows[0]
        ? { elementId: priorRows.rows[0].value || null, updatedAt: priorRows.rows[0].updated_at }
        : { elementId: null, updatedAt: null };
      const ts = new Date().toISOString();
      const dwellMs = prior.updatedAt
        ? new Date(ts).getTime() - new Date(prior.updatedAt).getTime()
        : null;
      await client.query(`
        INSERT INTO state (key, value, updated_at) VALUES ($1, $2, $3)
        ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at
      `, [CURRENT_KEY, elementId, ts]);
      await client.query(
        "INSERT INTO center_history (ts, from_id, to_id, dwell_ms) VALUES ($1, $2, $3, $4)",
        [ts, prior.elementId, elementId, dwellMs],
      );
      await client.query("COMMIT");
      return { ts, from: prior.elementId, to: elementId, dwellMs };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async recentChanges(limit = 20): Promise<CenterChange[]> {
    const { rows } = await this.pool.query<{ ts: string; from_id: string | null; to_id: string; dwell_ms: number | null }>(
      "SELECT ts, from_id, to_id, dwell_ms FROM center_history ORDER BY id DESC LIMIT $1",
      [limit],
    );
    return rows.map(r => ({ ts: r.ts, from: r.from_id, to: r.to_id, dwellMs: r.dwell_ms }));
  }
}
