import { readFile, appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Relation, ElementId } from "@ke/domain";
import { RelationSchema } from "@ke/domain";
import type { RelationsRepo } from "./RelationsRepo.js";

export class JsonRelationsRepo implements RelationsRepo {
  constructor(private root: string) {}

  private file() { return join(this.root, "relations.jsonl"); }

  async list(): Promise<Relation[]> {
    let raw: string;
    try { raw = await readFile(this.file(), "utf8"); }
    catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    return raw.split("\n").filter(l => l.trim()).map(l => JSON.parse(l) as Relation);
  }

  async byFrom(id: ElementId): Promise<Relation[]> {
    const all = await this.list();
    return all.filter(r => r.from === id);
  }

  async byTo(id: ElementId): Promise<Relation[]> {
    const all = await this.list();
    return all.filter(r => r.to === id);
  }

  async append(rels: Relation[]): Promise<void> {
    if (rels.length === 0) return;
    // Validate each at the boundary.
    for (const r of rels) {
      const result = RelationSchema.safeParse(r);
      if (!result.success) {
        const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).slice(0, 3).join("; ");
        throw new Error(`JsonRelationsRepo.append rejected ${r.id ?? "<no id>"}: ${issues}`);
      }
    }
    // De-dup vs. on-disk state: skip relations whose id we already have.
    const existing = new Set((await this.list()).map(r => r.id));
    const fresh = rels.filter(r => !existing.has(r.id));
    if (fresh.length === 0) return;
    await mkdir(dirname(this.file()), { recursive: true });
    const lines = fresh.map(r => JSON.stringify(r)).join("\n") + "\n";
    await appendFile(this.file(), lines);
  }
}
