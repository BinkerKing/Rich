import type Database from "better-sqlite3";
import type { Signal } from "@ke/domain";
import type { SignalsRepo, SignalsQuery } from "./SignalsRepo.js";

interface SignalRow {
  id: number;
  ts: string;
  type: string;
  manual: string | null;
  element_id: string | null;
  op: string | null;
  adapter: string | null;
  data: string | null;
}

function rowToSignal(r: SignalRow): Signal {
  return {
    ts: r.ts,
    type: r.type as Signal["type"],
    manual: r.manual ?? "",
    elementId: r.element_id ?? undefined,
    op: r.op ?? undefined,
    adapter: r.adapter ?? undefined,
    data: r.data ? JSON.parse(r.data) : undefined,
  };
}

export class SqliteSignalsRepo implements SignalsRepo {
  constructor(private db: Database.Database) {}

  async append(s: Signal): Promise<void> {
    this.db.prepare(`
      INSERT INTO signals (ts, type, manual, element_id, op, adapter, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      s.ts, s.type, s.manual ?? null, s.elementId ?? null, s.op ?? null,
      s.adapter ?? null, s.data ? JSON.stringify(s.data) : null,
    );
  }

  async list(q: SignalsQuery = {}): Promise<Signal[]> {
    const where: string[] = [];
    const args: unknown[] = [];
    if (q.manual)    { where.push("manual = ?");     args.push(q.manual); }
    if (q.type)      { where.push("type = ?");       args.push(q.type); }
    if (q.elementId) { where.push("element_id = ?"); args.push(q.elementId); }
    if (q.since)     { where.push("ts >= ?");        args.push(q.since); }
    let sql = "SELECT * FROM signals" + (where.length ? ` WHERE ${where.join(" AND ")}` : "") + " ORDER BY id";
    if (q.limit) sql += ` DESC LIMIT ${Number(q.limit)}`;
    const rows = this.db.prepare(sql).all(...args) as SignalRow[];
    const items = rows.map(rowToSignal);
    // When limit applied we fetched DESC; flip back to chronological order.
    return q.limit ? items.reverse() : items;
  }

  async count(): Promise<number> {
    const r = this.db.prepare("SELECT COUNT(*) AS n FROM signals").get() as { n: number };
    return r.n;
  }
}
