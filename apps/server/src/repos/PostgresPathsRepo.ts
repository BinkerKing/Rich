import type { ElementId, LearningPath, PathKind } from "@ke/domain";
import { LearningPathSchema } from "@ke/domain";
import { z } from "zod";
import type { PgPool } from "../db/postgres.js";
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

export class PostgresPathsRepo implements PathsRepo {
  constructor(private pool: PgPool) {}

  async byCenter(id: ElementId): Promise<LearningPath[]> {
    const { rows } = await this.pool.query<PathRow>("SELECT * FROM paths WHERE center_id = $1", [id]);
    return rows.map(rowToPath);
  }

  async putForCenter(id: ElementId, paths: LearningPath[]): Promise<void> {
    const result = PathArraySchema.safeParse(paths);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).slice(0, 3).join("; ");
      throw new Error(`PostgresPathsRepo.putForCenter rejected: ${issues}`);
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM paths WHERE center_id = $1", [id]);
      for (const p of paths) {
        await client.query(`
          INSERT INTO paths (id, center_id, kind, label, color, steps, estimated_time, created_at, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          p.id, p.centerElementId, p.kind, p.label, p.color,
          JSON.stringify(p.steps), p.estimatedTime ?? null, p.createdAt,
          JSON.stringify({ generatedBy: p.generatedBy }),
        ]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async appendForCenter(id: ElementId, paths: LearningPath[]): Promise<void> {
    if (paths.length === 0) return;
    const existing = await this.byCenter(id);
    const byId = new Map<string, LearningPath>();
    for (const p of existing) byId.set(p.id, p);
    for (const p of paths) byId.set(p.id, p);
    await this.putForCenter(id, Array.from(byId.values()));
  }

  async listAllCenters(): Promise<ElementId[]> {
    const { rows } = await this.pool.query<{ center_id: string }>("SELECT DISTINCT center_id FROM paths");
    return rows.map(r => r.center_id);
  }
}
