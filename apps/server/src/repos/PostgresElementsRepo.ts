import type { Element, ElementId } from "@ke/domain";
import type { PgPool } from "../db/postgres.js";
import type { ElementsRepo, ElementVersion } from "./ElementsRepo.js";

interface ElementRow {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  aliases: string | null;
  tags: string | null;
  domain: string | null;
  difficulty: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  generated_by: string;
  ai_model: string | null;
  ai_session_id: string | null;
  richness: number;
}

function rowToElement(r: ElementRow): Element {
  return {
    id: r.id,
    type: r.type as Element["type"],
    title: r.title,
    subtitle: r.subtitle ?? undefined,
    aliases: r.aliases ? JSON.parse(r.aliases) : undefined,
    tags: r.tags ? JSON.parse(r.tags) : undefined,
    domain: r.domain ?? undefined,
    difficulty: (r.difficulty as Element["difficulty"]) ?? undefined,
    content: JSON.parse(r.content),
    metadata: {
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      generatedBy: r.generated_by as "ai" | "user",
      aiModel: r.ai_model ?? undefined,
      aiSessionId: r.ai_session_id ?? undefined,
      richness: r.richness as 1 | 2 | 3 | 4 | 5,
    },
  };
}

function elementParams(el: Element) {
  return [
    el.id,
    el.type,
    el.title,
    el.subtitle ?? null,
    el.aliases ? JSON.stringify(el.aliases) : null,
    el.tags ? JSON.stringify(el.tags) : null,
    el.domain ?? null,
    el.difficulty ?? null,
    JSON.stringify(el.content),
    el.metadata.createdAt,
    el.metadata.updatedAt,
    el.metadata.generatedBy,
    el.metadata.aiModel ?? null,
    el.metadata.aiSessionId ?? null,
    el.metadata.richness,
  ];
}

export class PostgresElementsRepo implements ElementsRepo {
  constructor(private pool: PgPool) {}

  async list(): Promise<Element[]> {
    const { rows } = await this.pool.query<ElementRow>("SELECT * FROM elements");
    return rows.map(rowToElement);
  }

  async get(id: ElementId): Promise<Element | null> {
    const { rows } = await this.pool.query<ElementRow>("SELECT * FROM elements WHERE id = $1", [id]);
    return rows[0] ? rowToElement(rows[0]) : null;
  }

  async put(el: Element): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query<ElementRow>("SELECT * FROM elements WHERE id = $1", [el.id]);
      if (existing.rows[0]) {
        await client.query(
          `INSERT INTO element_versions (element_id, timestamp, snapshot)
           VALUES ($1, $2, $3)
           ON CONFLICT (element_id, timestamp) DO UPDATE SET snapshot = EXCLUDED.snapshot`,
          [existing.rows[0].id, existing.rows[0].updated_at, JSON.stringify(rowToElement(existing.rows[0]))],
        );
      }
      await client.query(`
        INSERT INTO elements (id, type, title, subtitle, aliases, tags, domain, difficulty, content, created_at, updated_at, generated_by, ai_model, ai_session_id, richness)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT(id) DO UPDATE SET
          type=EXCLUDED.type,
          title=EXCLUDED.title,
          subtitle=EXCLUDED.subtitle,
          aliases=EXCLUDED.aliases,
          tags=EXCLUDED.tags,
          domain=EXCLUDED.domain,
          difficulty=EXCLUDED.difficulty,
          content=EXCLUDED.content,
          created_at=EXCLUDED.created_at,
          updated_at=EXCLUDED.updated_at,
          generated_by=EXCLUDED.generated_by,
          ai_model=EXCLUDED.ai_model,
          ai_session_id=EXCLUDED.ai_session_id,
          richness=EXCLUDED.richness
      `, elementParams(el));
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async listVersions(id: ElementId): Promise<ElementVersion[]> {
    const { rows } = await this.pool.query<{ timestamp: string; snapshot: string }>(
      "SELECT timestamp, snapshot FROM element_versions WHERE element_id = $1 ORDER BY timestamp DESC",
      [id],
    );
    return rows.map(r => ({ timestamp: r.timestamp, element: JSON.parse(r.snapshot) as Element }));
  }

  async removeMany(ids: ElementId[]): Promise<void> {
    if (ids.length === 0) return;
    await this.pool.query("DELETE FROM element_versions WHERE element_id = ANY($1::text[])", [ids]);
    await this.pool.query("DELETE FROM elements WHERE id = ANY($1::text[])", [ids]);
  }

  async revertTo(id: ElementId, timestamp: string): Promise<Element> {
    const { rows } = await this.pool.query<{ snapshot: string }>(
      "SELECT snapshot FROM element_versions WHERE element_id = $1 AND timestamp = $2",
      [id, timestamp],
    );
    if (!rows[0]) throw new Error(`No version ${timestamp} for element ${id}`);
    const snapshot = JSON.parse(rows[0].snapshot) as Element;
    const next: Element = { ...snapshot, metadata: { ...snapshot.metadata, updatedAt: new Date().toISOString() } };
    await this.put(next);
    return next;
  }
}
