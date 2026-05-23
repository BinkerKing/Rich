import type { Signal } from "@ke/domain";
import type { PgPool } from "../db/postgres.js";
import type { SignalsQuery, SignalsRepo } from "./SignalsRepo.js";

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

export class PostgresSignalsRepo implements SignalsRepo {
  constructor(private pool: PgPool) {}

  async append(s: Signal): Promise<void> {
    await this.pool.query(`
      INSERT INTO signals (ts, type, manual, element_id, op, adapter, data)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      s.ts, s.type, s.manual ?? null, s.elementId ?? null, s.op ?? null,
      s.adapter ?? null, s.data ? JSON.stringify(s.data) : null,
    ]);
  }

  async list(q: SignalsQuery = {}): Promise<Signal[]> {
    const where: string[] = [];
    const args: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      args.push(value);
      where.push(sql.replace("?", `$${args.length}`));
    };
    if (q.manual) add("manual = ?", q.manual);
    if (q.type) add("type = ?", q.type);
    if (q.elementId) add("element_id = ?", q.elementId);
    if (q.since) add("ts >= ?", q.since);
    let sql = "SELECT * FROM signals" + (where.length ? ` WHERE ${where.join(" AND ")}` : "");
    if (q.limit) {
      args.push(Number(q.limit));
      sql += ` ORDER BY id DESC LIMIT $${args.length}`;
    } else {
      sql += " ORDER BY id";
    }
    const { rows } = await this.pool.query<SignalRow>(sql, args);
    const items = rows.map(rowToSignal);
    return q.limit ? items.reverse() : items;
  }

  async count(): Promise<number> {
    const { rows } = await this.pool.query<{ n: string }>("SELECT COUNT(*) AS n FROM signals");
    return Number(rows[0]?.n ?? 0);
  }
}
