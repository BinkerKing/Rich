import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { LearningPath, ElementId } from "@ke/domain";
import type { PathsRepo } from "./PathsRepo.js";

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
    await mkdir(this.dir(), { recursive: true });
    await writeFile(this.file(id), JSON.stringify(paths, null, 2));
  }

  async listAllCenters(): Promise<ElementId[]> {
    let files: string[];
    try { files = await readdir(this.dir()); }
    catch { return []; }
    return files.filter(f => f.endsWith(".json")).map(f => f.replace(/\.json$/, ""));
  }
}
