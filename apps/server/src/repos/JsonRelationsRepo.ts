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

  private async writeAll(rels: Relation[]): Promise<void> {
    const { writeFile } = await import("node:fs/promises");
    await mkdir(dirname(this.file()), { recursive: true });
    await writeFile(this.file(), rels.map(r => JSON.stringify(r)).join("\n") + (rels.length ? "\n" : ""));
  }

  async removeForElements(ids: ElementId[]): Promise<void> {
    if (ids.length === 0) return;
    const set = new Set(ids);
    const kept = (await this.list()).filter(r => !set.has(r.from) && !set.has(r.to));
    await this.writeAll(kept);
  }

  async reorderChildren(parentId: ElementId, childIds: ElementId[]): Promise<void> {
    const all = await this.list();
    // Slots = indices in `all` where this parent's child relations live.
    const slots: number[] = [];
    const childRels: Relation[] = [];
    for (let i = 0; i < all.length; i++) {
      const r = all[i];
      if (r.kind === "child" && r.from === parentId) {
        slots.push(i);
        childRels.push(r);
      }
    }
    if (slots.length === 0) return;
    const byTo = new Map(childRels.map(r => [r.to, r]));
    const reordered: Relation[] = [];
    const seen = new Set<string>();
    for (const cid of childIds) {
      const r = byTo.get(cid);
      if (!r) continue;
      seen.add(cid);
      reordered.push(r);
    }
    for (const r of childRels) {
      if (!seen.has(r.to)) reordered.push(r);
    }
    // Write back into the original slots so relations with other parents
    // (interleaved in the file) stay where they are.
    const next = all.slice();
    for (let i = 0; i < slots.length; i++) next[slots[i]] = reordered[i];
    await this.writeAll(next);
  }

  async reparent(childId: ElementId, newParentId: ElementId | null): Promise<void> {
    const all = await this.list();
    const kept = all.filter(r => !(r.kind === "child" && r.to === childId));
    if (newParentId) {
      kept.push({
        id: `rel.move.${newParentId}.${childId}`,
        from: newParentId,
        to: childId,
        kind: "child",
        createdAt: new Date().toISOString(),
      });
    }
    await this.writeAll(kept);
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
