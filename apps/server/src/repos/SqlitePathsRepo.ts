import type Database from "better-sqlite3";
import type { LearningPath, ElementId, PathKind } from "@ke/domain";
import { LearningPathSchema } from "@ke/domain";
import { z } from "zod";
import type { PathsRepo } from "./PathsRepo.js";

const PathArraySchema = z.array(LearningPathSchema);

interface PathRow {
  id: string;
  center_id: string;
  kind: string;
  label: string | null;
  color: string | null;
  steps: string;
  estimated_time: string | null;
  created_at: string;
  metadata: string | null;
}

function rowToPath(r: PathRow): LearningPath {
  const meta = r.metadata ? (JSON.parse(r.metadata) as { generatedBy?: "ai" | "user" }) : {};
  return {
    id: r.id,
    centerElementId: r.center_id,
    kind: r.kind as PathKind,
    label: r.label ?? "",
    color: r.color ?? "",
    steps: JSON.parse(r.steps),
    estimatedTime: r.estimated_time ?? undefined,
    generatedBy: meta.generatedBy ?? "ai",
    createdAt: r.created_at,
  };
}

export class SqlitePathsRepo implements PathsRepo {
  constructor(private db: Database.Database) {}

  async byCenter(id: ElementId): Promise<LearningPath[]> {
    const rows = this.db.prepare("SELECT * FROM paths WHERE center_id = ?").all(id) as PathRow[];
    return rows.map(rowToPath);
  }

  async putForCenter(id: ElementId, paths: LearningPath[]): Promise<void> {
    const result = PathArraySchema.safeParse(paths);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).slice(0, 3).join("; ");
      throw new Error(`SqlitePathsRepo.putForCenter rejected: ${issues}`);
    }
    const tx = this.db.transaction((centerId: ElementId, ps: LearningPath[]) => {
      this.db.prepare("DELETE FROM paths WHERE center_id = ?").run(centerId);
      const insert = this.db.prepare(`
        INSERT INTO paths (id, center_id, kind, label, color, steps, estimated_time, created_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of ps) {
        insert.run(
          p.id, p.centerElementId, p.kind, p.label, p.color,
          JSON.stringify(p.steps), p.estimatedTime ?? null, p.createdAt,
          JSON.stringify({ generatedBy: p.generatedBy }),
        );
      }
    });
    tx(id, paths);
  }

  async appendForCenter(id: ElementId, newPaths: LearningPath[]): Promise<void> {
    if (newPaths.length === 0) return;
    const existing = await this.byCenter(id);
    const byId = new Map<string, LearningPath>();
    for (const p of existing) byId.set(p.id, p);
    for (const p of newPaths) byId.set(p.id, p);
    await this.putForCenter(id, Array.from(byId.values()));
  }

  async listAllCenters(): Promise<ElementId[]> {
    const rows = this.db.prepare("SELECT DISTINCT center_id FROM paths").all() as Array<{ center_id: string }>;
    return rows.map(r => r.center_id);
  }
}
