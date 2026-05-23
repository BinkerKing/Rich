import type Database from "better-sqlite3";
import type { GreatMeRepo } from "./GreatMeRepo.js";

/**
 * SQLite-backed GreatMeRepo. Reuses the existing key/value `state` table
 * (see db/sqlite.ts) under a single dedicated key — no new schema needed.
 */
const KEY = "greatme.cockpit.v2";

export class SqliteGreatMeRepo implements GreatMeRepo {
  constructor(private db: Database.Database) {}

  async get(): Promise<unknown | null> {
    const row = this.db.prepare("SELECT value FROM state WHERE key = ?").get(KEY) as
      | { value: string }
      | undefined;
    if (!row) return null;
    try { return JSON.parse(row.value); } catch { return null; }
  }

  async put(value: unknown): Promise<void> {
    const ts = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO state (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `).run(KEY, JSON.stringify(value), ts);
  }
}
