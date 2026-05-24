import type Database from "better-sqlite3";
import type { CorpusTemplate } from "../ai/corpus.js";
import { normalizeCorpusTemplates } from "../ai/corpus.js";
import type { CorpusRepo } from "./CorpusRepo.js";

const KEY = "ai.corpus.templates.v1";

export class SqliteCorpusRepo implements CorpusRepo {
  constructor(private db: Database.Database) {}

  async getAll(): Promise<CorpusTemplate[] | null> {
    const row = this.db.prepare("SELECT value FROM state WHERE key = ?").get(KEY) as
      | { value: string }
      | undefined;
    if (!row) return null;
    try { return normalizeCorpusTemplates(JSON.parse(row.value)); } catch { return null; }
  }

  async putAll(templates: CorpusTemplate[]): Promise<void> {
    const ts = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO state (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `).run(KEY, JSON.stringify(templates), ts);
  }
}
