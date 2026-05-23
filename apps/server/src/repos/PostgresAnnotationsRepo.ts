import type { Annotation } from "@ke/domain";
import type { PgPool } from "../db/postgres.js";
import type { AnnotationsRepo } from "./AnnotationsRepo.js";

interface AnnotationRow {
  id: string;
  element_id: string;
  kind: string;
  text: string;
  context_before: string | null;
  context_after: string | null;
  note: string | null;
  analysis: string | null;
  created_at: string;
}

function rowToAnnotation(r: AnnotationRow): Annotation {
  return {
    id: r.id,
    elementId: r.element_id,
    kind: r.kind as Annotation["kind"],
    text: r.text,
    contextBefore: r.context_before ?? undefined,
    contextAfter: r.context_after ?? undefined,
    note: r.note ?? undefined,
    analysis: r.analysis ? JSON.parse(r.analysis) : undefined,
    createdAt: r.created_at,
  };
}

export class PostgresAnnotationsRepo implements AnnotationsRepo {
  constructor(private pool: PgPool) {}

  async append(a: Annotation): Promise<void> {
    await this.pool.query(`
      INSERT INTO annotations (id, element_id, kind, text, context_before, context_after, note, analysis, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      a.id, a.elementId, a.kind, a.text,
      a.contextBefore ?? null, a.contextAfter ?? null, a.note ?? null,
      a.analysis ? JSON.stringify(a.analysis) : null,
      a.createdAt,
    ]);
  }

  async remove(id: string): Promise<boolean> {
    const res = await this.pool.query("DELETE FROM annotations WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async update(id: string, patch: Partial<Annotation>): Promise<Annotation | null> {
    const currentRows = await this.pool.query<AnnotationRow>("SELECT * FROM annotations WHERE id = $1", [id]);
    if (!currentRows.rows[0]) return null;
    const current = rowToAnnotation(currentRows.rows[0]);
    const next: Annotation = { ...current, ...patch, id: current.id, elementId: current.elementId };
    await this.pool.query(`
      UPDATE annotations SET kind=$1, text=$2, context_before=$3, context_after=$4, note=$5, analysis=$6
      WHERE id = $7
    `, [
      next.kind, next.text, next.contextBefore ?? null, next.contextAfter ?? null,
      next.note ?? null, next.analysis ? JSON.stringify(next.analysis) : null,
      id,
    ]);
    return next;
  }

  async listForElement(elementId: string): Promise<Annotation[]> {
    const { rows } = await this.pool.query<AnnotationRow>(
      "SELECT * FROM annotations WHERE element_id = $1 ORDER BY created_at",
      [elementId],
    );
    return rows.map(rowToAnnotation);
  }
}
