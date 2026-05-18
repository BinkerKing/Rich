import type Database from "better-sqlite3";
import type { Annotation } from "@ke/domain";
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

export class SqliteAnnotationsRepo implements AnnotationsRepo {
  constructor(private db: Database.Database) {}

  async append(a: Annotation): Promise<void> {
    this.db.prepare(`
      INSERT INTO annotations (id, element_id, kind, text, context_before, context_after, note, analysis, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      a.id, a.elementId, a.kind, a.text,
      a.contextBefore ?? null, a.contextAfter ?? null, a.note ?? null,
      a.analysis ? JSON.stringify(a.analysis) : null,
      a.createdAt,
    );
  }

  async remove(id: string): Promise<boolean> {
    const res = this.db.prepare("DELETE FROM annotations WHERE id = ?").run(id);
    return res.changes > 0;
  }

  async update(id: string, patch: Partial<Annotation>): Promise<Annotation | null> {
    const row = this.db.prepare("SELECT * FROM annotations WHERE id = ?").get(id) as AnnotationRow | undefined;
    if (!row) return null;
    const current = rowToAnnotation(row);
    const next: Annotation = { ...current, ...patch, id: current.id, elementId: current.elementId };
    this.db.prepare(`
      UPDATE annotations SET kind=?, text=?, context_before=?, context_after=?, note=?, analysis=?
      WHERE id = ?
    `).run(
      next.kind, next.text, next.contextBefore ?? null, next.contextAfter ?? null,
      next.note ?? null, next.analysis ? JSON.stringify(next.analysis) : null,
      id,
    );
    return next;
  }

  async listForElement(elementId: string): Promise<Annotation[]> {
    const rows = this.db.prepare(
      "SELECT * FROM annotations WHERE element_id = ? ORDER BY created_at",
    ).all(elementId) as AnnotationRow[];
    return rows.map(rowToAnnotation);
  }
}
