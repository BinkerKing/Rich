import type { Element, ElementId } from "@ke/domain";
import type { ElementsRepo } from "./ElementsRepo.js";

/**
 * In-memory write-through cache for an ElementsRepo.
 *
 * Loaded lazily on first `list()` or `get()`. Subsequent reads are O(1) by id.
 * Writes go through to the underlying repo first, then update the cache.
 *
 * Tradeoff: cache is per-process. Multiple server processes against the same
 * data dir will drift unless we add invalidation. For MVP (single local server)
 * this is acceptable.
 */
export class CachedElementsRepo implements ElementsRepo {
  private cache: Map<ElementId, Element> | null = null;

  constructor(private inner: ElementsRepo) {}

  private async ensureLoaded(): Promise<Map<ElementId, Element>> {
    if (this.cache) return this.cache;
    const all = await this.inner.list();
    this.cache = new Map(all.map(e => [e.id, e]));
    return this.cache;
  }

  async list(): Promise<Element[]> {
    const c = await this.ensureLoaded();
    return Array.from(c.values());
  }

  async get(id: ElementId): Promise<Element | null> {
    const c = await this.ensureLoaded();
    return c.get(id) ?? null;
  }

  async put(el: Element): Promise<void> {
    await this.inner.put(el);
    const c = await this.ensureLoaded();
    c.set(el.id, el);
  }

  /** Test-only / admin: drop the cache so the next read re-loads from disk. */
  invalidate(): void {
    this.cache = null;
  }
}
