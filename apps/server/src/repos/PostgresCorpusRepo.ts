import type { PgPool } from "../db/postgres.js";
import type { CorpusTemplate } from "../ai/corpus.js";
import { normalizeCorpusTemplates } from "../ai/corpus.js";
import type { CorpusRepo } from "./CorpusRepo.js";

const KEY = "ai.corpus.templates.v1";

export class PostgresCorpusRepo implements CorpusRepo {
  constructor(private pool: PgPool) {}

  async getAll(): Promise<CorpusTemplate[] | null> {
    const { rows } = await this.pool.query<{ value: string }>("SELECT value FROM state WHERE key = $1", [KEY]);
    if (!rows[0]) return null;
    try { return normalizeCorpusTemplates(JSON.parse(rows[0].value)); } catch { return null; }
  }

  async putAll(templates: CorpusTemplate[]): Promise<void> {
    const ts = new Date().toISOString();
    await this.pool.query(`
      INSERT INTO state (key, value, updated_at) VALUES ($1, $2, $3)
      ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at
    `, [KEY, JSON.stringify(templates), ts]);
  }
}
