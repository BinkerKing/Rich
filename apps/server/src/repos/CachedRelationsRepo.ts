import type { Relation, ElementId } from "@ke/domain";
import type { RelationsRepo } from "./RelationsRepo.js";

/**
 * In-memory write-through cache for a RelationsRepo with from/to indexes.
 *
 * Without this, every `byFrom(id)` / `byTo(id)` call reads the entire jsonl file
 * and filters in memory. With this, indexes are O(N) once and lookups O(k).
 */
export class CachedRelationsRepo implements RelationsRepo {
  private all: Relation[] | null = null;
  private byFromIdx: Map<ElementId, Relation[]> = new Map();
  private byToIdx: Map<ElementId, Relation[]> = new Map();

  constructor(private inner: RelationsRepo) {}

  private async ensureLoaded(): Promise<void> {
    if (this.all) return;
    this.all = await this.inner.list();
    for (const rel of this.all) this.index(rel);
  }

  private index(rel: Relation): void {
    const f = this.byFromIdx.get(rel.from) ?? [];
    f.push(rel);
    this.byFromIdx.set(rel.from, f);
    const t = this.byToIdx.get(rel.to) ?? [];
    t.push(rel);
    this.byToIdx.set(rel.to, t);
  }

  async list(): Promise<Relation[]> {
    await this.ensureLoaded();
    return [...(this.all ?? [])];
  }

  async byFrom(id: ElementId): Promise<Relation[]> {
    await this.ensureLoaded();
    return [...(this.byFromIdx.get(id) ?? [])];
  }

  async byTo(id: ElementId): Promise<Relation[]> {
    await this.ensureLoaded();
    return [...(this.byToIdx.get(id) ?? [])];
  }

  async append(rels: Relation[]): Promise<void> {
    if (rels.length === 0) return;
    await this.inner.append(rels);
    if (!this.all) return;
    // De-dup vs. cache (inner already dedupes vs disk, but the cache may
    // already hold an id from a prior append that hasn't been re-loaded).
    const have = new Set(this.all.map(r => r.id));
    for (const rel of rels) {
      if (have.has(rel.id)) continue;
      this.all.push(rel);
      this.index(rel);
    }
  }

  async removeForElements(ids: ElementId[]): Promise<void> {
    await this.inner.removeForElements(ids);
    this.invalidate();
  }

  async reparent(childId: ElementId, newParentId: ElementId | null): Promise<void> {
    await this.inner.reparent(childId, newParentId);
    this.invalidate();
  }

  async reorderChildren(parentId: ElementId, childIds: ElementId[]): Promise<void> {
    await this.inner.reorderChildren(parentId, childIds);
    this.invalidate();
  }

  invalidate(): void {
    this.all = null;
    this.byFromIdx.clear();
    this.byToIdx.clear();
  }
}
