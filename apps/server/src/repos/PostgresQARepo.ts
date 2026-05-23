import type { QARecord } from "@ke/domain";
import type { PgPool } from "../db/postgres.js";
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

export class PostgresQARepo implements QARepo {
  constructor(private pool: PgPool) {}

  async append(qa: QARecord): Promise<void> {
    await this.pool.query(`
      INSERT INTO qa (id, element_id, question, answer, anchor, created_at, ai_model, ai_session_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      qa.id, qa.elementId, qa.question, qa.answer,
      qa.anchor ? JSON.stringify(qa.anchor) : null,
      qa.createdAt, qa.aiModel ?? null, qa.aiSessionId ?? null,
    ]);
  }

  async remove(id: string): Promise<boolean> {
    const res = await this.pool.query("DELETE FROM qa WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async removeForElements(elementIds: string[]): Promise<void> {
    if (elementIds.length === 0) return;
    await this.pool.query("DELETE FROM qa WHERE element_id = ANY($1::text[])", [elementIds]);
  }

  async listForElement(elementId: string): Promise<QARecord[]> {
    const { rows } = await this.pool.query<QARow>(
      "SELECT * FROM qa WHERE element_id = $1 ORDER BY created_at",
      [elementId],
    );
    return rows.map(rowToQA);
  }
}
