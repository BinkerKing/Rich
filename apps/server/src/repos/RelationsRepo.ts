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
  /** Reorder the direct child relations under `parentId`. `childIds` is the
   *  desired full list of direct children in display order. Any existing
   *  children not in the list are appended at the end in their original order.
   *  Other relations (cross-parent, non-child kinds) are untouched. */
  reorderChildren(parentId: ElementId, childIds: ElementId[]): Promise<void>;
}
