import type { Relation, ElementId } from "@ke/domain";

export interface RelationsRepo {
  list(): Promise<Relation[]>;
  byFrom(id: ElementId): Promise<Relation[]>;
  byTo(id: ElementId): Promise<Relation[]>;
  append(rels: Relation[]): Promise<void>;
  /** Remove all relations whose from or to is in the given id set. */
  removeForElements(ids: ElementId[]): Promise<void>;
  /** Replace the parent edge for `childId`. If newParentId is null, remove the parent edge entirely. */
  reparent(childId: ElementId, newParentId: ElementId | null): Promise<void>;
}
