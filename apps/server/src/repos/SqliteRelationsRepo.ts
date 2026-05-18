import type Database from "better-sqlite3";
import type { Relation, ElementId } from "@ke/domain";
import { RelationSchema } from "@ke/domain";
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

export class SqliteRelationsRepo implements RelationsRepo {
  constructor(private db: Database.Database) {}

  async list(): Promise<Relation[]> {
    const rows = this.db.prepare("SELECT * FROM relations").all() as RelationRow[];
    return rows.map(rowToRelation);
  }

  async byFrom(id: ElementId): Promise<Relation[]> {
    const rows = this.db.prepare("SELECT * FROM relations WHERE from_id = ?").all(id) as RelationRow[];
    return rows.map(rowToRelation);
  }

  async byTo(id: ElementId): Promise<Relation[]> {
    const rows = this.db.prepare("SELECT * FROM relations WHERE to_id = ?").all(id) as RelationRow[];
    return rows.map(rowToRelation);
  }

  async removeForElements(ids: ElementId[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => "?").join(",");
    this.db.prepare(`DELETE FROM relations WHERE from_id IN (${placeholders}) OR to_id IN (${placeholders})`)
      .run(...ids, ...ids);
  }

  async reparent(childId: ElementId, newParentId: ElementId | null): Promise<void> {
    const tx = this.db.transaction(() => {
      // Remove any existing child-edge pointing at this element.
      this.db.prepare("DELETE FROM relations WHERE kind = 'child' AND to_id = ?").run(childId);
      if (newParentId) {
        this.db.prepare(`
          INSERT INTO relations (id, from_id, to_id, kind, strength, reason, created_at)
          VALUES (?, ?, ?, 'child', NULL, NULL, ?)
          ON CONFLICT(id) DO UPDATE SET from_id=excluded.from_id, to_id=excluded.to_id
        `).run(`rel.move.${newParentId}.${childId}`, newParentId, childId, new Date().toISOString());
      }
    });
    tx();
  }

  async append(rels: Relation[]): Promise<void> {
    if (rels.length === 0) return;
    for (const r of rels) {
      const result = RelationSchema.safeParse(r);
      if (!result.success) {
        const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).slice(0, 3).join("; ");
        throw new Error(`SqliteRelationsRepo.append rejected ${r.id ?? "<no id>"}: ${issues}`);
      }
    }
    const stmt = this.db.prepare(`
      INSERT INTO relations (id, from_id, to_id, kind, strength, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `);
    const tx = this.db.transaction((rs: Relation[]) => {
      for (const r of rs) {
        stmt.run(r.id, r.from, r.to, r.kind, r.strength ?? null, r.reason ?? null, r.createdAt);
      }
    });
    tx(rels);
  }
}
