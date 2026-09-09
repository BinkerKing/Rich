import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { Deliverable, DeliverablesRepo } from "./DeliverablesRepo.js";

type Row = { id: string; title: string; content_json: string; created_at: string; updated_at: string };
const read = (row: Row): Deliverable => ({ id: row.id, title: row.title, content: JSON.parse(row.content_json) as Record<string, unknown>, createdAt: row.created_at, updatedAt: row.updated_at });

export class SqliteDeliverablesRepo implements DeliverablesRepo {
  constructor(private readonly db: Database.Database) {}
  async list(): Promise<Deliverable[]> { return (this.db.prepare("SELECT * FROM deliverables ORDER BY updated_at DESC").all() as Row[]).map(read); }
  async get(id: string): Promise<Deliverable | null> { const row = this.db.prepare("SELECT * FROM deliverables WHERE id = ?").get(id) as Row | undefined; return row ? read(row) : null; }
  async create(input: Pick<Deliverable, "title" | "content">): Promise<Deliverable> {
    const now = new Date().toISOString(); const item = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
    this.db.prepare("INSERT INTO deliverables (id, title, content_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(item.id, item.title, JSON.stringify(item.content), now, now);
    return item;
  }
  async update(id: string, patch: Partial<Pick<Deliverable, "title" | "content">>): Promise<Deliverable | null> {
    const current = await this.get(id); if (!current) return null;
    const item = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.db.prepare("UPDATE deliverables SET title = ?, content_json = ?, updated_at = ? WHERE id = ?").run(item.title, JSON.stringify(item.content), item.updatedAt, id);
    return item;
  }
  async remove(id: string): Promise<boolean> { return this.db.prepare("DELETE FROM deliverables WHERE id = ?").run(id).changes > 0; }
}
