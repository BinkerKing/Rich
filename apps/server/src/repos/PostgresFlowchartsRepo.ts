import { randomUUID } from "node:crypto";
import type { PgPool } from "../db/postgres.js";
import type { Flowchart, FlowchartsRepo } from "./FlowchartsRepo.js";

type Row = { id: string; title: string; graph_json: Record<string, unknown>; created_at: string; updated_at: string };
const read = (row: Row): Flowchart => ({ id: row.id, title: row.title, graph: row.graph_json, createdAt: row.created_at, updatedAt: row.updated_at });

export class PostgresFlowchartsRepo implements FlowchartsRepo {
  constructor(private readonly pool: PgPool) {}
  async list(): Promise<Flowchart[]> { return (await this.pool.query<Row>("SELECT * FROM flowcharts ORDER BY updated_at DESC")).rows.map(read); }
  async get(id: string): Promise<Flowchart | null> { const row = (await this.pool.query<Row>("SELECT * FROM flowcharts WHERE id = $1", [id])).rows[0]; return row ? read(row) : null; }
  async create(input: Pick<Flowchart, "title" | "graph">): Promise<Flowchart> {
    const now = new Date().toISOString(); const item = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
    await this.pool.query("INSERT INTO flowcharts (id, title, graph_json, created_at, updated_at) VALUES ($1, $2, $3::jsonb, $4, $5)", [item.id, item.title, JSON.stringify(item.graph), now, now]);
    return item;
  }
  async update(id: string, patch: Partial<Pick<Flowchart, "title" | "graph">>): Promise<Flowchart | null> {
    const current = await this.get(id); if (!current) return null;
    const item = { ...current, ...patch, updatedAt: new Date().toISOString() };
    await this.pool.query("UPDATE flowcharts SET title = $1, graph_json = $2::jsonb, updated_at = $3 WHERE id = $4", [item.title, JSON.stringify(item.graph), item.updatedAt, id]);
    return item;
  }
  async remove(id: string): Promise<boolean> { return ((await this.pool.query("DELETE FROM flowcharts WHERE id = $1", [id])).rowCount ?? 0) > 0; }
}
