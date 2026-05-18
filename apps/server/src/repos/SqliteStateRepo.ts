import type Database from "better-sqlite3";
import type { ElementId } from "@ke/domain";
import type { StateRepo, CenterChange } from "./StateRepo.js";

const CURRENT_KEY = "center.current";

export class SqliteStateRepo implements StateRepo {
  constructor(private db: Database.Database) {}

  async getCenter(): Promise<{ elementId: ElementId | null; updatedAt: string | null }> {
    const row = this.db.prepare("SELECT value, updated_at FROM state WHERE key = ?").get(CURRENT_KEY) as
      | { value: string; updated_at: string }
      | undefined;
    if (!row) return { elementId: null, updatedAt: null };
    return { elementId: row.value || null, updatedAt: row.updated_at };
  }

  async setCenter(elementId: ElementId): Promise<CenterChange> {
    const prior = await this.getCenter();
    const ts = new Date().toISOString();
    const dwellMs = prior.updatedAt
      ? new Date(ts).getTime() - new Date(prior.updatedAt).getTime()
      : null;
    const change: CenterChange = { ts, from: prior.elementId, to: elementId, dwellMs };
    const tx = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO state (key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
      `).run(CURRENT_KEY, elementId, ts);
      this.db.prepare(`
        INSERT INTO center_history (ts, from_id, to_id, dwell_ms) VALUES (?, ?, ?, ?)
      `).run(ts, prior.elementId, elementId, dwellMs);
    });
    tx();
    return change;
  }

  async recentChanges(limit = 20): Promise<CenterChange[]> {
    const rows = this.db.prepare(
      "SELECT ts, from_id, to_id, dwell_ms FROM center_history ORDER BY id DESC LIMIT ?",
    ).all(limit) as Array<{ ts: string; from_id: string | null; to_id: string; dwell_ms: number | null }>;
    return rows.map(r => ({ ts: r.ts, from: r.from_id, to: r.to_id, dwellMs: r.dwell_ms }));
  }
}
