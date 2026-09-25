import { randomUUID } from "node:crypto";
import type { PgPool } from "../db/postgres.js";
import type { DeepMindMap, DeepMindMapCreateInput, DeepMindMapUpdateInput, DeepMindMapsRepo } from "./DeepMindMapsRepo.js";

type Row = { id: string; title: string; map_json: Record<string, unknown>; created_at: string; updated_at: string };
const read = (row: Row): DeepMindMap => ({ id: row.id, title: row.title, map: row.map_json, createdAt: row.created_at, updatedAt: row.updated_at });

export class PostgresDeepMindMapsRepo implements DeepMindMapsRepo {
  constructor(private readonly pool: PgPool) {}
  async list(): Promise<DeepMindMap[]> { return (await this.pool.query<Row>("SELECT * FROM deep_mindmaps ORDER BY updated_at DESC")).rows.map(read); }
  async get(id: string): Promise<DeepMindMap | null> { const row = (await this.pool.query<Row>("SELECT * FROM deep_mindmaps WHERE id = $1", [id])).rows[0]; return row ? read(row) : null; }
  async create(input: DeepMindMapCreateInput): Promise<DeepMindMap> {
    if (input.id && input.importOnly) { const existing = await this.get(input.id); if (existing) return existing; }
    const now = new Date().toISOString(); const item = { id: input.id ?? randomUUID(), title: input.title, map: input.map, createdAt: now, updatedAt: now };
    await this.pool.query("INSERT INTO deep_mindmaps (id, title, map_json, created_at, updated_at) VALUES ($1, $2, $3::jsonb, $4, $5)", [item.id, item.title, JSON.stringify(item.map), now, now]);
    return item;
  }
  async update(id: string, input: DeepMindMapUpdateInput): Promise<DeepMindMap | "conflict" | null> {
    const current = await this.get(id); if (!current) return null;
    if (current.updatedAt !== input.expectedUpdatedAt) return "conflict";
    const item = { ...current, title: input.title, map: input.map, updatedAt: new Date().toISOString() };
    await this.pool.query("UPDATE deep_mindmaps SET title = $1, map_json = $2::jsonb, updated_at = $3 WHERE id = $4", [item.title, JSON.stringify(item.map), item.updatedAt, id]);
    return item;
  }
  async remove(id: string): Promise<boolean> { return ((await this.pool.query("DELETE FROM deep_mindmaps WHERE id = $1", [id])).rowCount ?? 0) > 0; }
}
