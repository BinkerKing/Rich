import type { Relation, ElementId } from "@ke/domain";
import { RelationSchema } from "@ke/domain";
import type { PgPool } from "../db/postgres.js";
import type { RelationsRepo } from "./RelationsRepo.js";

interface RelationRow {
  id: string;
  from_id: string;
  to_id: string;
  kind: string;
  strength: number | null;
  reason: string | null;
  created_at: string;
}

function rowToRelation(r: RelationRow): Relation {
  return {
    id: r.id,
    from: r.from_id,
    to: r.to_id,
    kind: r.kind as Relation["kind"],
    strength: r.strength ?? undefined,
    reason: r.reason ?? undefined,
    createdAt: r.created_at,
  };
}

export class PostgresRelationsRepo implements RelationsRepo {
  constructor(private pool: PgPool) {}

  async list(): Promise<Relation[]> {
    const { rows } = await this.pool.query<RelationRow>("SELECT * FROM relations ORDER BY order_id");
    return rows.map(rowToRelation);
  }

  async byFrom(id: ElementId): Promise<Relation[]> {
    const { rows } = await this.pool.query<RelationRow>(
      "SELECT * FROM relations WHERE from_id = $1 ORDER BY order_id",
      [id],
    );
    return rows.map(rowToRelation);
  }

  async byTo(id: ElementId): Promise<Relation[]> {
    const { rows } = await this.pool.query<RelationRow>("SELECT * FROM relations WHERE to_id = $1", [id]);
    return rows.map(rowToRelation);
  }

  async removeForElements(ids: ElementId[]): Promise<void> {
    if (ids.length === 0) return;
    await this.pool.query(
      "DELETE FROM relations WHERE from_id = ANY($1::text[]) OR to_id = ANY($1::text[])",
      [ids],
    );
  }

  async reorderChildren(parentId: ElementId, childIds: ElementId[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<RelationRow>(
        "SELECT * FROM relations WHERE kind = 'child' AND from_id = $1 ORDER BY order_id",
        [parentId],
      );
      if (rows.length === 0) {
        await client.query("COMMIT");
        return;
      }
      const byTo = new Map(rows.map(r => [r.to_id, r]));
      await client.query("DELETE FROM relations WHERE kind = 'child' AND from_id = $1", [parentId]);
      const seen = new Set<string>();
      const insert = `
        INSERT INTO relations (id, from_id, to_id, kind, strength, reason, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      for (const cid of childIds) {
        const r = byTo.get(cid);
        if (!r) continue;
        seen.add(cid);
        await client.query(insert, [r.id, r.from_id, r.to_id, r.kind, r.strength, r.reason, r.created_at]);
      }
      for (const r of rows) {
        if (!seen.has(r.to_id)) {
          await client.query(insert, [r.id, r.from_id, r.to_id, r.kind, r.strength, r.reason, r.created_at]);
        }
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async reparent(childId: ElementId, newParentId: ElementId | null): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM relations WHERE kind = 'child' AND to_id = $1", [childId]);
      if (newParentId) {
        await client.query(`
          INSERT INTO relations (id, from_id, to_id, kind, strength, reason, created_at)
          VALUES ($1, $2, $3, 'child', NULL, NULL, $4)
          ON CONFLICT(id) DO UPDATE SET from_id=EXCLUDED.from_id, to_id=EXCLUDED.to_id
        `, [`rel.move.${newParentId}.${childId}`, newParentId, childId, new Date().toISOString()]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async append(rels: Relation[]): Promise<void> {
    if (rels.length === 0) return;
    for (const r of rels) {
      const result = RelationSchema.safeParse(r);
      if (!result.success) {
        const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).slice(0, 3).join("; ");
        throw new Error(`PostgresRelationsRepo.append rejected ${r.id ?? "<no id>"}: ${issues}`);
      }
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const r of rels) {
        await client.query(`
          INSERT INTO relations (id, from_id, to_id, kind, strength, reason, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT(id) DO NOTHING
        `, [r.id, r.from, r.to, r.kind, r.strength ?? null, r.reason ?? null, r.createdAt]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
