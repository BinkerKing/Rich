import type Database from "better-sqlite3";
import type { QARecord } from "@ke/domain";
import type { QARepo } from "./QARepo.js";

interface QARow {
  id: string;
  element_id: string;
  question: string;
  answer: string;
  anchor: string | null;
  created_at: string;
  ai_model: string | null;
  ai_session_id: string | null;
}

function rowToQA(r: QARow): QARecord {
  return {
    id: r.id,
    elementId: r.element_id,
    question: r.question,
    answer: r.answer,
    anchor: r.anchor ? JSON.parse(r.anchor) : undefined,
    createdAt: r.created_at,
    aiModel: r.ai_model ?? undefined,
    aiSessionId: r.ai_session_id ?? undefined,
  };
}

export class SqliteQARepo implements QARepo {
  constructor(private db: Database.Database) {}

  async append(qa: QARecord): Promise<void> {
    this.db.prepare(`
      INSERT INTO qa (id, element_id, question, answer, anchor, created_at, ai_model, ai_session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      qa.id, qa.elementId, qa.question, qa.answer,
      qa.anchor ? JSON.stringify(qa.anchor) : null,
      qa.createdAt, qa.aiModel ?? null, qa.aiSessionId ?? null,
    );
  }

  async remove(id: string): Promise<boolean> {
    const res = this.db.prepare("DELETE FROM qa WHERE id = ?").run(id);
    return res.changes > 0;
  }

  async removeForElements(elementIds: string[]): Promise<void> {
    if (elementIds.length === 0) return;
    const placeholders = elementIds.map(() => "?").join(",");
    this.db.prepare(`DELETE FROM qa WHERE element_id IN (${placeholders})`).run(...elementIds);
  }

  async listForElement(elementId: string): Promise<QARecord[]> {
    const rows = this.db.prepare(
      "SELECT * FROM qa WHERE element_id = ? ORDER BY created_at",
    ).all(elementId) as QARow[];
    return rows.map(rowToQA);
  }
}
