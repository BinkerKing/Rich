import { readFile, writeFile, mkdir, readdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { LearningPath, ElementId } from "@ke/domain";
import { LearningPathSchema } from "@ke/domain";
import type { PathsRepo } from "./PathsRepo.js";

const PathArraySchema = z.array(LearningPathSchema);

export class JsonPathsRepo implements PathsRepo {
  constructor(private root: string) {}

  private dir() { return join(this.root, "paths"); }
  private file(id: ElementId) { return join(this.dir(), `${id}.json`); }

  async byCenter(id: ElementId): Promise<LearningPath[]> {
    try {
      const raw = await readFile(this.file(id), "utf8");
      return JSON.parse(raw) as LearningPath[];
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  async putForCenter(id: ElementId, paths: LearningPath[]): Promise<void> {
    const result = PathArraySchema.safeParse(paths);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).slice(0, 3).join("; ");
      throw new Error(`JsonPathsRepo.putForCenter rejected: ${issues}`);
    }
    await mkdir(this.dir(), { recursive: true });
    const final = this.file(id);
    const tmp = `${final}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmp, JSON.stringify(paths, null, 2));
    await rename(tmp, final);
  }

  async appendForCenter(id: ElementId, newPaths: LearningPath[]): Promise<void> {
    if (newPaths.length === 0) return;
    const existing = await this.byCenter(id);
    const byId = new Map<string, LearningPath>();
    for (const p of existing) byId.set(p.id, p);
    for (const p of newPaths) byId.set(p.id, p); // new wins
    await this.putForCenter(id, Array.from(byId.values()));
  }

  async listAllCenters(): Promise<ElementId[]> {
    let files: string[];
    try { files = await readdir(this.dir()); }
    catch { return []; }
    return files.filter(f => f.endsWith(".json")).map(f => f.replace(/\.json$/, ""));
  }
}
