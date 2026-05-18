import type Database from "better-sqlite3";
import type { Element, ElementId } from "@ke/domain";
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

export class SqliteElementsRepo implements ElementsRepo {
  constructor(private db: Database.Database) {}

  async list(): Promise<Element[]> {
    const rows = this.db.prepare("SELECT * FROM elements").all() as ElementRow[];
    return rows.map(rowToElement);
  }

  async get(id: ElementId): Promise<Element | null> {
    const row = this.db.prepare("SELECT * FROM elements WHERE id = ?").get(id) as ElementRow | undefined;
    return row ? rowToElement(row) : null;
  }

  /** Persist `el`. If an element with the same id exists, archive it first. */
  async put(el: Element): Promise<void> {
    const tx = this.db.transaction((next: Element) => {
      const existing = this.db.prepare("SELECT * FROM elements WHERE id = ?").get(next.id) as ElementRow | undefined;
      if (existing) {
        this.db.prepare(
          "INSERT OR REPLACE INTO element_versions (element_id, timestamp, snapshot) VALUES (?, ?, ?)",
        ).run(existing.id, existing.updated_at, JSON.stringify(rowToElement(existing)));
      }
      this.db.prepare(`
        INSERT INTO elements (id, type, title, subtitle, aliases, tags, domain, difficulty, content, created_at, updated_at, generated_by, ai_model, ai_session_id, richness)
        VALUES (@id, @type, @title, @subtitle, @aliases, @tags, @domain, @difficulty, @content, @created_at, @updated_at, @generated_by, @ai_model, @ai_session_id, @richness)
        ON CONFLICT(id) DO UPDATE SET
          type=excluded.type,
          title=excluded.title,
          subtitle=excluded.subtitle,
          aliases=excluded.aliases,
          tags=excluded.tags,
          domain=excluded.domain,
          difficulty=excluded.difficulty,
          content=excluded.content,
          created_at=excluded.created_at,
          updated_at=excluded.updated_at,
          generated_by=excluded.generated_by,
          ai_model=excluded.ai_model,
          ai_session_id=excluded.ai_session_id,
          richness=excluded.richness
      `).run({
        id: next.id,
        type: next.type,
        title: next.title,
        subtitle: next.subtitle ?? null,
        aliases: next.aliases ? JSON.stringify(next.aliases) : null,
        tags: next.tags ? JSON.stringify(next.tags) : null,
        domain: next.domain ?? null,
        difficulty: next.difficulty ?? null,
        content: JSON.stringify(next.content),
        created_at: next.metadata.createdAt,
        updated_at: next.metadata.updatedAt,
        generated_by: next.metadata.generatedBy,
        ai_model: next.metadata.aiModel ?? null,
        ai_session_id: next.metadata.aiSessionId ?? null,
        richness: next.metadata.richness,
      });
    });
    tx(el);
  }

  async listVersions(id: ElementId): Promise<ElementVersion[]> {
    const rows = this.db.prepare(
      "SELECT timestamp, snapshot FROM element_versions WHERE element_id = ? ORDER BY timestamp DESC",
    ).all(id) as Array<{ timestamp: string; snapshot: string }>;
    return rows.map(r => ({ timestamp: r.timestamp, element: JSON.parse(r.snapshot) as Element }));
  }

  async removeMany(ids: ElementId[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => "?").join(",");
    const tx = this.db.transaction((xs: ElementId[]) => {
      this.db.prepare(`DELETE FROM element_versions WHERE element_id IN (${placeholders})`).run(...xs);
      this.db.prepare(`DELETE FROM elements WHERE id IN (${placeholders})`).run(...xs);
    });
    tx(ids);
  }

  async revertTo(id: ElementId, timestamp: string): Promise<Element> {
    const row = this.db.prepare(
      "SELECT snapshot FROM element_versions WHERE element_id = ? AND timestamp = ?",
    ).get(id, timestamp) as { snapshot: string } | undefined;
    if (!row) throw new Error(`No version ${timestamp} for element ${id}`);
    const snapshot = JSON.parse(row.snapshot) as Element;
    // bump the updatedAt so order stays consistent
    const next: Element = { ...snapshot, metadata: { ...snapshot.metadata, updatedAt: new Date().toISOString() } };
    await this.put(next);
    return next;
  }
}
