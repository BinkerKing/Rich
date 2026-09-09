import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { Flowchart, FlowchartsRepo } from "./FlowchartsRepo.js";

type Row = { id: string; title: string; graph_json: string; created_at: string; updated_at: string };
const read = (row: Row): Flowchart => ({ id: row.id, title: row.title, graph: JSON.parse(row.graph_json) as Record<string, unknown>, createdAt: row.created_at, updatedAt: row.updated_at });

export class SqliteFlowchartsRepo implements FlowchartsRepo {
  constructor(private readonly db: Database.Database) {}
  async list(): Promise<Flowchart[]> { return (this.db.prepare("SELECT * FROM flowcharts ORDER BY updated_at DESC").all() as Row[]).map(read); }
  async get(id: string): Promise<Flowchart | null> { const row = this.db.prepare("SELECT * FROM flowcharts WHERE id = ?").get(id) as Row | undefined; return row ? read(row) : null; }
  async create(input: Pick<Flowchart, "title" | "graph">): Promise<Flowchart> {
    const now = new Date().toISOString(); const item = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
    this.db.prepare("INSERT INTO flowcharts (id, title, graph_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(item.id, item.title, JSON.stringify(item.graph), now, now);
    return item;
  }
  async update(id: string, patch: Partial<Pick<Flowchart, "title" | "graph">>): Promise<Flowchart | null> {
    const current = await this.get(id); if (!current) return null;
    const item = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.db.prepare("UPDATE flowcharts SET title = ?, graph_json = ?, updated_at = ? WHERE id = ?").run(item.title, JSON.stringify(item.graph), item.updatedAt, id);
    return item;
  }
  async remove(id: string): Promise<boolean> { return this.db.prepare("DELETE FROM flowcharts WHERE id = ?").run(id).changes > 0; }
}
