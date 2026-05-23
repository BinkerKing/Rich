import type { PgPool } from "../db/postgres.js";
import type { GreatMeRepo } from "./GreatMeRepo.js";

const KEY = "greatme.cockpit.v2";

export class PostgresGreatMeRepo implements GreatMeRepo {
  constructor(private pool: PgPool) {}

  async get(): Promise<unknown | null> {
    const { rows } = await this.pool.query<{ value: string }>("SELECT value FROM state WHERE key = $1", [KEY]);
    if (!rows[0]) return null;
    try { return JSON.parse(rows[0].value); } catch { return null; }
  }

  async put(value: unknown): Promise<void> {
    const ts = new Date().toISOString();
    await this.pool.query(`
      INSERT INTO state (key, value, updated_at) VALUES ($1, $2, $3)
      ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at
    `, [KEY, JSON.stringify(value), ts]);
  }
}
