import { randomUUID } from "node:crypto";
import type { PgPool } from "../db/postgres.js";
import type { Deliverable, DeliverablesRepo } from "./DeliverablesRepo.js";

type Row = { id: string; title: string; content_json: Record<string, unknown>; created_at: string; updated_at: string };
const read = (row: Row): Deliverable => ({ id: row.id, title: row.title, content: row.content_json, createdAt: row.created_at, updatedAt: row.updated_at });

export class PostgresDeliverablesRepo implements DeliverablesRepo {
  constructor(private readonly pool: PgPool) {}
  async list(): Promise<Deliverable[]> { return (await this.pool.query<Row>("SELECT * FROM deliverables ORDER BY updated_at DESC")).rows.map(read); }
  async get(id: string): Promise<Deliverable | null> { const row = (await this.pool.query<Row>("SELECT * FROM deliverables WHERE id = $1", [id])).rows[0]; return row ? read(row) : null; }
  async create(input: Pick<Deliverable, "title" | "content">): Promise<Deliverable> {
    const now = new Date().toISOString(); const item = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
    await this.pool.query("INSERT INTO deliverables (id, title, content_json, created_at, updated_at) VALUES ($1, $2, $3::jsonb, $4, $5)", [item.id, item.title, JSON.stringify(item.content), now, now]);
    return item;
  }
  async update(id: string, patch: Partial<Pick<Deliverable, "title" | "content">>): Promise<Deliverable | null> {
    const current = await this.get(id); if (!current) return null;
    const item = { ...current, ...patch, updatedAt: new Date().toISOString() };
    await this.pool.query("UPDATE deliverables SET title = $1, content_json = $2::jsonb, updated_at = $3 WHERE id = $4", [item.title, JSON.stringify(item.content), item.updatedAt, id]);
    return item;
  }
  async remove(id: string): Promise<boolean> { return ((await this.pool.query("DELETE FROM deliverables WHERE id = $1", [id])).rowCount ?? 0) > 0; }
}
