import type { Element, ElementId } from "@ke/domain";

export interface ElementVersion {
  timestamp: string; // ISO 8601 of when this version was archived
  element: Element;
}

export interface ElementsRepo {
  list(): Promise<Element[]>;
  get(id: ElementId): Promise<Element | null>;
  /** Persist `el`. Implementations that maintain history archive the previous version. */
  put(el: Element): Promise<void>;
  /** Returns archived prior versions, newest-first. Empty if no history. */
  listVersions(id: ElementId): Promise<ElementVersion[]>;
  /** Restore `id` to the snapshot at `timestamp`. Throws if not found. */
  revertTo(id: ElementId, timestamp: string): Promise<Element>;
}
